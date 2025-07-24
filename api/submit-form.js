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

  // Run validations
  for (const validate of validations) {
    await validate.run(req);
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn('⚠️ Validation errors:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
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

    const sanitizedData = {
      ...formData,
      firstName: sanitizeHtml(formData.firstName),
      lastName: sanitizeHtml(formData.lastName),
      email: sanitizeHtml(formData.email),
      eventName: sanitizeHtml(formData.eventName),
      eventLocation: sanitizeHtml(formData.eventLocation),
      eventDate: sanitizeHtml(formData.eventDate),
      submittedAt: new Date()
    };

    const insertResult = await submissions.insertOne(sanitizedData);
    console.log('📥 Incoming sanitized form payload:', sanitizedData);
    console.log('📝 Mongo Insert Result:', insertResult);

    const startTime = new Date(sanitizedData.eventDate);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    const eventDetails = {
      startTime,
      endTime,
      summary: sanitizedData.eventName,
      description: `Event at ${sanitizedData.eventLocation}`,
      location: sanitizedData.eventLocation,
      organizer: {
        name: `${sanitizedData.firstName} ${sanitizedData.lastName}`.trim(),
        email: sanitizedData.email
      }
    };

    const selectedUser = {
      name: `${sanitizedData.firstName} ${sanitizedData.lastName}`.trim(),
      email: sanitizedData.email
    };

    console.log('📦 Parsed and sanitized fields:', { eventDetails, selectedUser });

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
