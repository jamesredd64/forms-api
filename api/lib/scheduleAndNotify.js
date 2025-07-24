const { getDb } = require('../utils/mongoClient'); // Adjust path as needed
const { generateICalEvent } = require('../utils/ical.utils');
const nodemailer = require('nodemailer');

function compareDates(isoString, dateString) {
  return isoString.split('T')[0] === dateString;
}

// Setup email transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function scheduleAndNotify({ eventDetails, selectedUser }) {
  if (!eventDetails || !selectedUser || !selectedUser.email) {
    throw new Error('Missing required eventDetails or selectedUser');
  }

  try {
    const db = await getDb();
    const ScheduledEvents = db.collection('scheduledEvents'); // Use lowercase or adjust if collection is mapped differently

    // 🔎 Look for existing event by summary, location, organizer email
    const candidates = await ScheduledEvents.find({
      'eventDetails.summary': eventDetails.summary,
      'eventDetails.location': eventDetails.location,
      'eventDetails.organizer.email': eventDetails.organizer?.email
    }).toArray();

    const existingEvent = candidates.find(event =>
      compareDates(event.eventDetails?.startTime?.toISOString?.(), eventDetails.startTime.toISOString().split('T')[0])
    );

    let finalEvent;

    if (existingEvent) {
      // 🛠 Update existing
      const update = {
        $set: {
          'eventDetails.endTime': new Date(eventDetails.endTime),
          'eventDetails.description': eventDetails.description,
          'eventDetails.location': eventDetails.location,
          'eventDetails.organizer': eventDetails.organizer,
          scheduledTime: new Date(),
          status: 'pending'
        },
        $addToSet: {
          selectedUsers: selectedUser
        }
      };

      await ScheduledEvents.updateOne({ _id: existingEvent._id }, update);
      finalEvent = await ScheduledEvents.findOne({ _id: existingEvent._id });
    } else {
      // 🆕 Create new
      const startDate = new Date(eventDetails.startTime);
      startDate.setUTCHours(0, 0, 0, 0);
      eventDetails.startTime = new Date(startDate);
      eventDetails.endTime = new Date(startDate);
      eventDetails.endTime.setUTCHours(23, 59, 59, 999);

      const newEvent = {
        eventDetails,
        scheduledTime: new Date(),
        selectedUsers: [selectedUser],
        status: 'pending'
      };

      const insertResult = await ScheduledEvents.insertOne(newEvent);
      finalEvent = { ...newEvent, _id: insertResult.insertedId };
    }

    // 📧 Send email invite
    const icsContent = generateICalEvent({
      ...eventDetails,
      to: selectedUser
    });

    const mailOptions = {
      from: eventDetails.organizer?.email || process.env.EMAIL_USER,
      to: selectedUser.email,
      subject: eventDetails.summary || 'Event Invite',
      text: 'Please find the calendar event attached.',
      html: '<p>Please find the calendar event attached. Click to add to your calendar.</p>',
      icalEvent: {
        filename: 'invitation.ics',
        method: 'REQUEST',
        content: icsContent
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📬 Invite sent:', info.accepted);

    return {
      success: true,
      eventId: finalEvent._id,
      message: 'Event scheduled and invitation sent.'
    };
  } catch (error) {
    console.error('❌ scheduleAndNotify failed in micro:', error.message);
    throw error;
  }
}

module.exports = scheduleAndNotify;
