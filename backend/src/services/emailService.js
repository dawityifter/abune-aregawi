'use strict';
const nodemailer = require('nodemailer');

function getMailerConfig() {
  const user = process.env.MAILER_GMAIL_USER || process.env.GMAIL_USER || 'abune.aregawi.dev@gmail.com';
  const clientId = process.env.MAILER_GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.MAILER_GMAIL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.MAILER_GMAIL_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing mail OAuth env vars. Set MAILER_GMAIL_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN (preferred) or GMAIL_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN.'
    );
  }

  return {
    user,
    clientId,
    clientSecret,
    refreshToken
  };
}

function createTransporter() {
  const { user, clientId, clientSecret, refreshToken } = getMailerConfig();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
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
  const { user } = getMailerConfig();
  await transporter.sendMail({
    from: `"Debre Tsehay Abune Aregawi Church" <${user}>`,
    to,
    subject,
    text,
    attachments,
  });
}

module.exports = { sendEmail };
