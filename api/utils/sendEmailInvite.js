const nodemailer = require('nodemailer');
const { generateICalEvent } = require('./ical.utils');


// Configure transporter with your micro env settings
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmailInvite({ eventDetails, selectedUser }) {
  try {
    if (!eventDetails || !selectedUser || !selectedUser.email) {
      throw new Error('Missing required invite details');
    }

    const icsContent = generateICalEvent({
      ...eventDetails,
      to: selectedUser
    });

    const mailOptions = {
      from: eventDetails.organizer?.email || process.env.EMAIL_USER,
      to: selectedUser.email,
      subject: eventDetails.summary || 'Event Invitation',
      text: 'Please find the calendar event attached.',
      html: '<p>Please find the calendar event attached. Click to add to your calendar.</p>',
      icalEvent: {
        filename: 'invitation.ics',
        method: 'REQUEST',
        content: icsContent
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📬 Email sent:', info.accepted);
    return { success: true, info };
  } catch (err) {
    console.error('❌ Failed to send invite email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = sendEmailInvite;
