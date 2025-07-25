const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, text } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const data = await resend.emails.send({
      from: 'noreply@showcase.education', // Must be verified in Resend dashboard
      to,
      subject,
      text
    });

    console.log('📬 Resend response:', data);
    return res.status(200).json({ success: true, message: 'Email sent', id: data.id });
  } catch (error) {
    console.error('❌ Resend email failed:', error);
    return res.status(500).json({ error: error.message });
  }
};
