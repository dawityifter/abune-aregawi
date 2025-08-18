'use strict';

const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (ACCOUNT_SID && AUTH_TOKEN) {
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
}

const ensureConfigured = () => {
  if (!client || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
  }
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendSms(to, body) {
  ensureConfigured();
  return client.messages.create({ from: TWILIO_PHONE_NUMBER, to, body });
}

// Batch sender with throttling: max 20 concurrent, optional delay between batches
async function sendSmsBatch(recipients, body, options = {}) {
  ensureConfigured();
  const {
    concurrency = 20,
    delayMsBetweenBatches = 1000,
  } = options;

  const results = [];
  for (let i = 0; i < recipients.length; i += concurrency) {
    const batch = recipients.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(async (to) => {
      try {
        const res = await sendSms(to, body);
        return { to, success: true, sid: res.sid };
      } catch (err) {
        return { to, success: false, error: err.message };
      }
    }));
    results.push(...batchResults);
    if (i + concurrency < recipients.length && delayMsBetweenBatches > 0) {
      await sleep(delayMsBetweenBatches);
    }
  }
  return results;
}

module.exports = {
  sendSms,
  sendSmsBatch,
};
