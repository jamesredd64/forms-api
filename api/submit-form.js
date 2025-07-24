const { getDb } = require('./utils/mongoClient');
const tokenStore = require('./utils/tokenStore.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formData = req.body;
  const token = formData.token;

  // Uncomment this block when token validation is ready
  // const isLocal = process.env.RUN_MODE === 'd'; // or use NODE_ENV if preferred
  // if (!isLocal && !tokenStore.isValid(token)) {
  //   return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  // }

  try {
    const db = await getDb();
    const submissions = db.collection('formSubmissions');

    // Save form data
    const result = await submissions.insertOne({
      ...formData,
      submittedAt: new Date()
    });

    // Build structured payload for main server
    const eventDetails = {
      startTime: new Date(formData.eventDate),
      endTime: new Date(new Date(formData.eventDate).getTime() + 2 * 60 * 60 * 1000), // 2-hour event
      summary: formData.eventName,
      description: `Event at ${formData.eventLocation}`,
      location: formData.eventLocation,
      organizer: {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email
      }
    };

    const selectedUser = {
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email
    };

    // Trigger custom logic on main server
    await fetch('https://admin-backend-eta.vercel.app/api/forms/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventDetails, selectedUser })
    });

    return res.status(200).json({
      success: true,
      insertedId: result.insertedId,
      message: 'Form submitted and event processing triggered.'
    });
  } catch (err) {
    console.error('❌ Submit form failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
