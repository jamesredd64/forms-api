const { getDb } = require('../utils/mongoClient');
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
    const ScheduledEvents = db.collection('scheduledEvents');

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

    // ⏱️ Check for duplicate invite within 10 minutes
    const isDuplicateInvite = existingEvent?.selectedUsers?.some(u =>
      u.email === selectedUser.email &&
      u.lastInvitedAt &&
      new Date() - new Date(u.lastInvitedAt) < 10 * 60 * 1000
    );

    if (isDuplicateInvite) {
      console.warn('⏱️ Skipping re-invite: Recently sent to', selectedUser.email);
      return {
        success: true,
        eventId: existingEvent._id,
        message: 'Invite already sent recently — skipping.'
      };
    }

    selectedUser.lastInvitedAt = new Date(); // Add timestamp

    if (existingEvent) {
      // 🛠 Update existing event
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
      // 🆕 Create new event
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

    // 📧 Generate invite
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

    const recentInvite = await db.collection('invitesSent').findOne({
        to: selectedUser.email,
        summary: eventDetails.summary,
        location: eventDetails.location,
        sentAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // last 10 minutes
      });
      
      if (recentInvite) {
        console.warn('⏱️ Invite already sent recently via invitesSent log. Skipping.');
        return {
          success: true,
          eventId: finalEvent?._id,
          message: 'Duplicate invite detected in invite log — skipping send.'
        };
      }
      
    const info = await transporter.sendMail(mailOptions);      
      // 🗂️ Log sent invite
      console.log('📬 Invite sent:', info.accepted);

    await db.collection('invitesSent').insertOne({
    eventId: finalEvent._id,
    to: selectedUser.email,
    name: selectedUser.name,
    summary: eventDetails.summary,
    location: eventDetails.location,
    sentAt: new Date(),
    organizer: eventDetails.organizer?.email,
    source: 'microservice'
  });
  

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
