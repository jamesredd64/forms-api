const { getDb } = require('./utils/mongoClient');
const tokenStore = require('./utils/tokenStore');
const scheduleAndNotify = require('./lib/scheduleAndNotify');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const formData = req.body;
  const token = formData.token;

  // Optional token validation
  // const isLocal = process.env.RUN_MODE === 'd';
  // if (!isLocal && !tokenStore.isValid(token)) {
  //   return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  // }

  try {
    const db = await getDb();
    const submissions = db.collection('formsubmissions');

    const insertResult = await submissions.insertOne({
      ...formData,
      submittedAt: new Date()
    });

    console.log('📥 Incoming form payload:', formData);
    console.log('📝 Mongo Insert Result:', insertResult);

    // Extract Webflow-style payload
    const data = formData?.payload?.data || {};

    const {
      firstName = data['First Name'] || '',
      lastName = data['Last Name'] || '',
      email = data['E-Mail'] || '',
      eventName = data.eventName || '',
      eventLocation = data.eventLocation || '',
      eventDate = data['Event Time'] || ''
    } = data;

    const startTime = eventDate ? new Date(eventDate) : null;
    const endTime = startTime ? new Date(startTime.getTime() + 2 * 60 * 60 * 1000) : null;

    const eventDetails = {
      startTime,
      endTime,
      summary: eventName || 'Untitled Event',
      description: eventLocation ? `Event at ${eventLocation}` : 'No location provided',
      location: eventLocation || '',
      organizer: {
        name: `${firstName} ${lastName}`.trim(),
        email: email || process.env.EMAIL_USER
      }
    };

    const selectedUser = {
      name: `${firstName} ${lastName}`.trim(),
      email: email || ''
    };

    console.log('📦 Parsed form fields:', { eventDetails, selectedUser });

    // 🔁 Upsert event and send invite
    const result = await scheduleAndNotify({ eventDetails, selectedUser });

    return res.status(200).json({
      success: true,
      insertedId: insertResult.insertedId,
      eventId: result.eventId,
      message: result.message
    });
  } catch (err) {
    console.error('❌ Micro submit-form failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};


// const { getDb } = require('./utils/mongoClient');
// const tokenStore = require('./utils/tokenStore.js');
// const { generateICalEvent } = require('./utils/ical.utils');
// const sendEmailInvite = require('./utils/sendEmailInvite');

// module.exports = async (req, res) => {
//   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

//   const formData = req.body;
//   const token = formData.token;

//   // Uncomment when ready for validation
//   // const isLocal = process.env.RUN_MODE === 'd';
//   // if (!isLocal && !tokenStore.isValid(token)) {
//   //   return res.status(403).json({ success: false, error: 'Invalid or expired token' });
//   // }


//   try {
//     const db = await getDb();
//     const submissions = db.collection('formsubmissions');

//     const result = await submissions.insertOne({
//       ...formData,
//       submittedAt: new Date()
//     });

//     console.log('📝 MongoDB Database is :', submissions);
//     console.log('📝 MongoDB Insert Result:', result);
//     console.log('❌ Submit form data :', formData);

//     // Extract nested values from Webflow-style payload
//     const data = formData?.payload?.data || {};

//     const {
//       firstName = data['First Name'] || '',
//       lastName = data['Last Name'] || '',
//       email = data['E-Mail'] || '',
//       eventName = data.eventName || '',
//       eventLocation = data.eventLocation || '',
//       eventDate = data['Event Time'] || ''
//     } = data;

//     const startTime = eventDate ? new Date(eventDate) : null;
//     const endTime = eventDate ? new Date(startTime.getTime() + 2 * 60 * 60 * 1000) : null;

//     await sendEmailInvite({ eventDetails, selectedUser });

//     const eventDetails = {
//       startTime,
//       endTime,
//       summary: eventName || 'Untitled Event',
//       description: eventLocation ? `Event at ${eventLocation}` : 'No location specified',
//       location: eventLocation || '',
//       organizer: {
//         name: `${firstName} ${lastName}`.trim(),
//         email: email || ''
//       }
//     };

//     const selectedUser = {
//       name: `${firstName} ${lastName}`.trim(),
//       email: email || ''
//     };

//     console.log('📦 Parsed form fields:', { firstName, lastName, email, eventName, eventLocation, eventDate });
//     console.log('➡️ Sending to main server:', { eventDetails, selectedUser });

//     await fetch('https://admin-backend-eta.vercel.app/api/forms/submit-form', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ eventDetails, selectedUser })
//     });

//     return res.status(200).json({
//       success: true,
//       insertedId: result.insertedId,
//       message: 'Form submitted and event processing triggered.'
//     });
//   } catch (err) {
//     console.error('❌ Submit form failed:', err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };
