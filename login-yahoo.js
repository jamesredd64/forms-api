const nodemailer = require('nodemailer');

// Yahoo SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.mail.yahoo.com',
  port: 587,
  secure: false, // or 'STARTTLS'
  auth: {
    user: 'jameshredd@yahoo.com',
    pass: 'fivzcftsvtmdcyxo'
  }
});

// Email options
const mailOptions = {
  from: 'jameshredd@yahoo.com',
  to: 'jameshredd@outlook.com',
  subject: 'Hello from Node.js!',
  text: 'Hello, world!'
};

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});