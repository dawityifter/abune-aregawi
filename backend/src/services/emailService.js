'use strict';
const nodemailer = require('nodemailer');

function createTransporter() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error('Missing Gmail OAuth env vars (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: 'info@abunearegawi.church',
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
    },
  });
}

/**
 * Send an email with optional attachments.
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {Array}  [options.attachments]
 */
async function sendEmail({ to, subject, text, attachments = [] }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: '"Debre Tsehay Abune Aregawi Church" <info@abunearegawi.church>',
    to,
    subject,
    text,
    attachments,
  });
}

module.exports = { sendEmail };
