const { getDb } = require('../utils/mongoClient');
const { generateICalEvent } = require('../utils/ical.utils');
// const { Resend } = require('resend');
const nodemailer = require('nodemailer');

function compareDates(isoString, dateString) {
  return isoString.split('T')[0] === dateString;
}

// Setup email transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: process.env.PORT,
  secure: false, // TLS is used on port 587
  auth: {
    user: process.env.EMAIL_USER, // your full Yahoo email
    pass: process.env.EMAIL_PASS  // your app password
  },
  tls: {
    rejectUnauthorized: false // helps with TLS handshake in some edge cases
  }
});

  
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST || 'smtp.gmail.com',
//   port: process.env.EMAIL_PORT || 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

console.log('📧 Email transporter configured with:');
console.log('   USER:', "support@showcase.education");
console.log('   PASS:', "obne cmib ckbq lwts"); // app password
// console.log('   PASS:', process.env.EMAIL_PASS?.slice(0, 4) + '***'); // Masked for safety

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

    const normalizeDate = (dateStr) => {
        const date = new Date(dateStr);
        date.setUTCHours(0, 0, 0, 0);
        return date.getTime();
      };
      
      const existingEvent = candidates.find(event =>
        normalizeDate(event.eventDetails?.startTime) === normalizeDate(eventDetails.startTime)
      );      

      let finalEvent;      

    // ⏱️ Check for duplicate invite within 10 minutes
    const isDuplicateInvite = existingEvent?.selectedUsers?.some(u =>
      u.email === selectedUser.email &&
      u.lastInvitedAt &&
      new Date() - new Date(u.lastInvitedAt) < 2 * 60 * 1000
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
     
    const scheduledTime = finalEvent?.scheduledTime
    ? new Date(finalEvent.scheduledTime).toLocaleString()
    : '[No scheduled time]';

    // 📧 Compose mail with .ics calendar invite + headers
const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME,
      address: process.env.EMAIL_FROM
    },
    to: selectedUser.email,
    subject: eventDetails.summary || 'Event Invitation you asked for',
    text: `You are invited to ${eventDetails.summary} scheduled on ${scheduledTime}. Please find the calendar event attached.`,
    html: `<p>You are invited to ${eventDetails.summary} scheduled on ${scheduledTime}. Please find the calendar event attached. <a href="#">Click to add to your calendar</a>.</p>`,
    attachments: [
      {
        filename: 'invitation.ics',
        content: icsContent,
        contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
        contentDisposition: 'attachment',
        headers: {
          'Content-Class': 'urn:content-classes:calendarmessage'
        }
      }
    ]
    };  
    const recentInvite = await db.collection('invitesSent').findOne({
        to: selectedUser.email,
        summary: eventDetails.summary,
        location: eventDetails.location,
        sentAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // last 10 minutes
      });
      
      if (recentInvite) {
        console.warn('⏱️ Invite already sent recently via invitesSent log. Skipping email and user update.');
      
        // If this is an existing event, return it without modifying selectedUsers
        if (existingEvent) {
          return {
            success: true,
            eventId: existingEvent._id,
            message: 'Duplicate invite detected — skipping email and user update.'
          };
        }
      
        // Otherwise, create the event but skip user addition
        const newEvent = {
          eventDetails,
          scheduledTime: new Date(),
          selectedUsers: [],
          status: 'pending'
        };
      
        const insertResult = await ScheduledEvents.insertOne(newEvent);
      
        return {
          success: true,
          eventId: insertResult.insertedId,
          message: 'New event created, but invite was already sent — skipping user insert.'
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

// const { getDb } = require('../utils/mongoClient');
// const { generateICalEvent } = require('../utils/ical.utils');
// const { Resend } = require('resend');

// function compareDates(isoString, dateString) {
//   return isoString.split('T')[0] === dateString;
// }

// async function scheduleAndNotify({ eventDetails, selectedUser }) {
//   if (!eventDetails || !selectedUser || !selectedUser.email) {
//     throw new Error('Missing required eventDetails or selectedUser');
//   }

//   try {
//     const db = await getDb();
//     const ScheduledEvents = db.collection('scheduledEvents');

//     const candidates = await ScheduledEvents.find({
//       'eventDetails.summary': eventDetails.summary,
//       'eventDetails.location': eventDetails.location,
//       'eventDetails.organizer.email': eventDetails.organizer?.email
//     }).toArray();

//     const normalizeDate = (dateStr) => {
//       const date = new Date(dateStr);
//       date.setUTCHours(0, 0, 0, 0);
//       return date.getTime();
//     };

//     const existingEvent = candidates.find(event =>
//       normalizeDate(event.eventDetails?.startTime) === normalizeDate(eventDetails.startTime)
//     );

//     const isDuplicateInvite = existingEvent?.selectedUsers?.some(u =>
//       u.email === selectedUser.email &&
//       u.lastInvitedAt &&
//       new Date() - new Date(u.lastInvitedAt) < 2 * 60 * 1000
//     );

//     if (isDuplicateInvite) {
//       console.warn('⏱️ Skipping re-invite: Recently sent to', selectedUser.email);
//       return {
//         success: true,
//         eventId: existingEvent._id,
//         message: 'Invite already sent recently — skipping.'
//       };
//     }

//     selectedUser.lastInvitedAt = new Date();

//     let finalEvent;

//     if (existingEvent) {
//       const update = {
//         $set: {
//           'eventDetails.endTime': new Date(eventDetails.endTime),
//           'eventDetails.description': eventDetails.description,
//           'eventDetails.location': eventDetails.location,
//           'eventDetails.organizer': eventDetails.organizer,
//           scheduledTime: new Date(),
//           status: 'pending'
//         },
//         $addToSet: {
//           selectedUsers: selectedUser
//         }
//       };

//       await ScheduledEvents.updateOne({ _id: existingEvent._id }, update);
//       finalEvent = await ScheduledEvents.findOne({ _id: existingEvent._id });
//     } else {
//       const startDate = new Date(eventDetails.startTime);
//       startDate.setUTCHours(0, 0, 0, 0);
//       eventDetails.startTime = new Date(startDate);
//       eventDetails.endTime = new Date(startDate);
//       eventDetails.endTime.setUTCHours(23, 59, 59, 999);

//       const newEvent = {
//         eventDetails,
//         scheduledTime: new Date(),
//         selectedUsers: [selectedUser],
//         status: 'pending'
//       };

//       const insertResult = await ScheduledEvents.insertOne(newEvent);
//       finalEvent = { ...newEvent, _id: insertResult.insertedId };
//     }

//     const recentInvite = await db.collection('invitesSent').findOne({
//       to: selectedUser.email,
//       summary: eventDetails.summary,
//       location: eventDetails.location,
//       sentAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
//     });

//     if (recentInvite) {
//       console.warn('⏱️ Invite already sent recently via invitesSent log. Skipping email and user update.');

//       if (existingEvent) {
//         return {
//           success: true,
//           eventId: existingEvent._id,
//           message: 'Duplicate invite detected — skipping email and user update.'
//         };
//       }

//       const newEvent = {
//         eventDetails,
//         scheduledTime: new Date(),
//         selectedUsers: [],
//         status: 'pending'
//       };

//       const insertResult = await ScheduledEvents.insertOne(newEvent);

//       return {
//         success: true,
//         eventId: insertResult.insertedId,
//         message: 'New event created, but invite was already sent — skipping user insert.'
//       };
//     }

//     // 📧 Send email via Resend
//     const icsContent = generateICalEvent({ ...eventDetails, to: selectedUser });
//     const scheduledTime = new Date(eventDetails.scheduledTime).toLocaleString();
//     const resend = new Resend(process.env.RESEND_API_KEY);

//     await resend.emails.send({
//       from: eventDetails.organizer?.email || 'noreply@stagholme.com',
//       to: selectedUser.email,
//       subject: eventDetails.summary || 'Event Invitation you asked for',
//       text: `You are invited to ${eventDetails.summary} scheduled on ${scheduledTime}.`,
//       html: `<p>You are invited to ${eventDetails.summary} scheduled on ${scheduledTime}. <a href="#">Click to add to your calendar</a>.</p>`,
//       attachments: [
//         {
//           filename: 'invitation.ics',
//           content: Buffer.from(icsContent).toString('base64'),
//           type: 'text/calendar',
//           disposition: 'attachment'
//         }
//       ]
//     });

//     await db.collection('invitesSent').insertOne({
//       eventId: finalEvent._id,
//       to: selectedUser.email,
//       name: selectedUser.name,
//       summary: eventDetails.summary,
//       location: eventDetails.location,
//       sentAt: new Date(),
//       organizer: eventDetails.organizer?.email,
//       source: 'microservice'
//     });

//     return {
//       success: true,
//       eventId: finalEvent._id,
//       message: 'Event scheduled and invitation sent.'
//     };
//   } catch (error) {
//     console.error('❌ scheduleAndNotify failed in micro:', error.message);
//     throw error;
//   }
// }

// module.exports = scheduleAndNotify;
