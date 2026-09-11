'use strict';

const twilio = require('twilio');
const logger = require('../utils/logger');

/**
 * Twilio signs every webhook with HMAC-SHA1 over the full request URL plus the
 * POSTed parameters, using the account's auth token as the key. Without
 * checking that signature an endpoint is simply a public POST handler: anyone
 * who learns the path can forge a voicemail, invent a caller, and set off the
 * notifications that go to leadership.
 *
 * The signature covers the URL exactly as Twilio built it, which is the one
 * fragile part behind a reverse proxy. nginx terminates TLS and forwards over
 * http, so whether Express reconstructs "https" depends on X-Forwarded-Proto
 * reaching it. Rather than let a proxy detail reject genuine traffic, both
 * schemes are tried — the HMAC still has to match, so this costs no security,
 * and it is the difference between working and silently dropping every
 * voicemail. PUBLIC_API_BASE_URL, when set, removes the guesswork entirely.
 */
function candidateUrls(req) {
  const base = process.env.PUBLIC_API_BASE_URL;
  if (base) {
    return [`${base.replace(/\/+$/, '')}${req.originalUrl}`];
  }

  const host = req.get('host');
  return [
    `https://${host}${req.originalUrl}`,
    `http://${host}${req.originalUrl}`
  ];
}

/**
 * Replies in TwiML rather than JSON: the caller on the other end is a phone
 * call, and Twilio reads XML. An empty <Response/> hangs up quietly.
 */
function reject(res, status) {
  return res.status(status).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<Response/>');
}

function validateTwilioWebhook(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Fails closed. A missing token means nothing can be verified, and serving
  // the endpoint unverified is the exact state this middleware exists to end.
  if (!authToken) {
    logger.error('Twilio webhook rejected: TWILIO_AUTH_TOKEN is not configured');
    return reject(res, 503);
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    logger.warn('Twilio webhook rejected: no X-Twilio-Signature header', { url: req.originalUrl });
    return reject(res, 403);
  }

  const urls = candidateUrls(req);
  const params = req.body || {};
  const valid = urls.some((url) => twilio.validateRequest(authToken, signature, url, params));

  if (!valid) {
    // The URLs are logged because a mismatch here is almost always URL
    // reconstruction rather than an attack, and the tried values are what
    // makes that diagnosable in one look.
    logger.warn('Twilio webhook rejected: signature did not match', { tried: urls });
    return reject(res, 403);
  }

  return next();
}

module.exports = { validateTwilioWebhook };
