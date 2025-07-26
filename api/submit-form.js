const { getDb } = require('./utils/mongoClient');
const tokenStore = require('./utils/tokenStore');
const scheduleAndNotify = require('./lib/scheduleAndNotify');
const { validationResult, body } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const validations = [
  body('email').isEmail().withMessage('Valid email required'),
  body('firstName').isLength({ min: 2 }).withMessage('First name too short'),
  body('lastName').isLength({ min: 2 }).withMessage('Last name too short'),
  body('eventName').isLength({ min: 2 }).withMessage('Event name too short'),
  body('eventLocation').isLength({ min: 2 }).withMessage('Event location too short'),
  body('eventDate').notEmpty().withMessage('Event date is required'),
  body('token').optional().isString().withMessage('Token must be a string')
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const formData = req.body;
  const token = formData.token;
  const data = formData?.payload?.data || {};

  // ✅ Pull ISO date string from hidden field
  const parsedDateTime = data.eventDateTime || '';

  // 🧼 Flatten and sanitize fields
  req.body = {
    email: sanitizeHtml(data['E-Mail'] || ''),
    firstName: sanitizeHtml(data['First Name'] || ''),
    lastName: sanitizeHtml(data['Last Name'] || ''),
    eventName: sanitizeHtml(data.eventName || ''),
    eventLocation: sanitizeHtml(data.eventLocation || ''),
    eventDate: sanitizeHtml(parsedDateTime),
    token: sanitizeHtml(token || '')
  };

  // ✅ Run validations
  for (const validate of validations) {
    await validate.run(req);
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn('⚠️ Validation errors:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const db = await getDb();
    const submissions = db.collection('formsubmissions');

    // 🔧 Patch missing fields before storing
    const fallbackFields = {
      'Event Name': req.body.eventName,
      'Event Location': req.body.eventLocation,
      'Event Time': req.body.eventDate // stores ISO format now
    };

    for (const [key, val] of Object.entries(fallbackFields)) {
      formData.payload.data[key] ||= val;
    }

    // 🚿 Optional cleanup
    Object.keys(formData.payload.data).forEach(key => {
      if (formData.payload.data[key] === '') {
        delete formData.payload.data[key];
      }
    });

    const sanitizedSubmission = {
      ...formData,
      submittedAt: new Date()
    };

    const insertResult = await submissions.insertOne(sanitizedSubmission);
    console.log('📥 Incoming sanitized form payload:', sanitizedSubmission);

    const startTime = new Date(req.body.eventDate);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // +2hr duration

    const eventDetails = {
      startTime,
      endTime,
      summary: req.body.eventName,
      description: `Event at ${req.body.eventLocation}`,
      location: req.body.eventLocation,
      organizer: {
        name: `${req.body.firstName} ${req.body.lastName}`.trim(),
        email: req.body.email
      }
    };

    const selectedUser = {
      name: `${req.body.firstName} ${req.body.lastName}`.trim(),
      email: req.body.email
    };

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
// const tokenStore = require('./utils/tokenStore');
// const scheduleAndNotify = require('./lib/scheduleAndNotify');
// const { validationResult, body } = require('express-validator');
// const sanitizeHtml = require('sanitize-html');

// const validations = [
//   body('email').isEmail().withMessage('Valid email required'),
//   body('firstName').isLength({ min: 2 }).withMessage('First name too short'),
//   body('lastName').isLength({ min: 2 }).withMessage('Last name too short'),
//   body('eventName').isLength({ min: 2 }).withMessage('Event name too short'),
//   body('eventLocation').isLength({ min: 2 }).withMessage('Event location too short'),
//   body('eventDate').notEmpty().withMessage('Event date is required'),
//   body('token').optional().isString().withMessage('Token must be a string')
// ];

// module.exports = async (req, res) => {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const formData = req.body;
//   const token = formData.token;
//   const data = formData?.payload?.data || {};

//     // 🎯 Map label like "Time 2" to actual timestamp
//   const rawTimeChoice = data['Event Time'] || '';
//   const timeSlotMap = {
//     'Time 1': '2025-07-25T14:00:00.000Z',
//     'Time 2': '2025-07-25T18:00:00.000Z',
//     'Time 3': '2025-07-25T20:00:00.000Z'
//   };
//   const mappedTime = timeSlotMap[rawTimeChoice] || rawTimeChoice;


//   // 🧼 Flatten and sanitize fields for validation
//   req.body = {
//     email: sanitizeHtml(data['E-Mail'] || ''),
//     firstName: sanitizeHtml(data['First Name'] || ''),
//     lastName: sanitizeHtml(data['Last Name'] || ''),
//     eventName: sanitizeHtml(data.eventName || ''),
//     eventLocation: sanitizeHtml(data.eventLocation || ''),
//     eventDate: sanitizeHtml(data['Event Time'] || ''),
//     token: sanitizeHtml(token || '')
//   };

//   // ✅ Run validations
//   for (const validate of validations) {
//     await validate.run(req);
//   }

//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     console.warn('⚠️ Validation errors:', errors.array());
//     return res.status(400).json({ success: false, errors: errors.array() });
//   }

//   try {
//     const db = await getDb();
//     const submissions = db.collection('formsubmissions');

//     // 🔧 Patch missing fields before storing
//     const fallbackFields = {
//       'Event Name': req.body.eventName,
//       'Event Location': req.body.eventLocation,
//       'Event Time': req.body.eventDate
//     };

//     for (const [key, val] of Object.entries(fallbackFields)) {
//       formData.payload.data[key] ||= val;
//     }

//     // Optional cleanup: remove empty strings
//     Object.keys(formData.payload.data).forEach(key => {
//       if (formData.payload.data[key] === '') {
//         delete formData.payload.data[key];
//       }
//     });

//     const sanitizedSubmission = {
//       ...formData,
//       submittedAt: new Date()
//     };

//     const insertResult = await submissions.insertOne(sanitizedSubmission);
//     console.log('📥 Incoming sanitized form payload:', sanitizedSubmission);
//     console.log('📝 Mongo Insert Result:', insertResult);

//     const startTime = new Date(req.body.eventDate);
//     const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

//     const eventDetails = {
//       startTime,
//       endTime,
//       summary: req.body.eventName,
//       description: `Event at ${req.body.eventLocation}`,
//       location: req.body.eventLocation,
//       organizer: {
//         name: `${req.body.firstName} ${req.body.lastName}`.trim(),
//         email: req.body.email
//       }
//     };

//     const selectedUser = {
//       name: `${req.body.firstName} ${req.body.lastName}`.trim(),
//       email: req.body.email
//     };

//     console.log('📦 Parsed and sanitized fields:', { eventDetails, selectedUser });

//     const result = await scheduleAndNotify({ eventDetails, selectedUser });

//     return res.status(200).json({
//       success: true,
//       insertedId: insertResult.insertedId,
//       eventId: result.eventId,
//       message: result.message
//     });
//   } catch (err) {
//     console.error('❌ Micro submit-form failed:', err.message);
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };


