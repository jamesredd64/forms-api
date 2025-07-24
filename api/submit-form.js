const { getDb } = require('../utils/mongoClient');
const tokenStore = require('../utils/tokenStore.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formData = req.body;
  const token = formData.token;

  const isLocal = process.env.RUN_MODE === 'd'; // or use NODE_ENV if preferred
  if (!isLocal && !tokenStore.isValid(token)) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }

  try {
    const db = await getDb();
    const submissions = db.collection('formSubmissions');

    // Save form data
    const result = await submissions.insertOne({
      ...formData,
      submittedAt: new Date()
    });

    // Trigger custom logic (event upsert + email)
    await fetch('https://admin-backend-eta.vercel.app/api/forms/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
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
