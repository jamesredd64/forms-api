const { getDb } = require('../utils/mongoClient');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formData = req.body;

  try {
    const db = await getDb();
    const submissions = db.collection('formSubmissions');

    // Save form data
    const result = await submissions.insertOne({
      ...formData,
      submittedAt: new Date()
    });

    // Trigger custom logic (event upsert + email)
    // https://admin-backend-eta.vercel.app/
    await fetch('https://your-main-server.com/api/upsert-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    return res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error('❌ Submit form failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
