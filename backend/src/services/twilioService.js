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
    const batchResults = await Promise.all(batch.map(async (recipient) => {
      try {
        // Handle both string recipients (using common body) and object recipients (personalized)
        const to = typeof recipient === 'string' ? recipient : recipient.to;
        const msgBody = typeof recipient === 'string' ? body : recipient.body;

        if (!to || !msgBody) {
          throw new Error('Invalid recipient or missing message body');
        }

        const res = await sendSms(to, msgBody);
        return { to, success: true, sid: res.sid, metadata: recipient.metadata };
      } catch (err) {
        const to = typeof recipient === 'string' ? recipient : recipient.to;
        return { to, success: false, error: err.message, metadata: recipient.metadata };
      }
    }));
    results.push(...batchResults);
    if (i + concurrency < recipients.length && delayMsBetweenBatches > 0) {
      await sleep(delayMsBetweenBatches);
    }
  }
  return results;
}

// Fetch current SMS pricing for a country (defaults to US)
async function getSmsPricing(countryCode = 'US') {
  ensureConfigured();
  try {
    const pricing = await client.pricing.v1.messaging
      .countries(countryCode)
      .fetch();

    // Twilio returns inbound/outbound prices. We care about outbound.
    // Simplifying: grab the first outbound price (usually per carrier, but often similar)
    // For US, it's typically flat per segment + carrier fees.
    // This API returns base price. Carrier fees are separate but we can estimate.

    const outbound = pricing.outboundSmsPrices[0];
    const basePrice = outbound ? parseFloat(outbound.prices[0].current_price) : 0.0079;

    return {
      basePrice,
      currency: pricing.priceUnit || 'USD',
      carrierFeeEstimate: 0.0025 // Average US carrier fee estimate
    };
  } catch (error) {
    console.warn('Failed to fetch Twilio pricing, using defaults:', error.message);
    return {
      basePrice: 0.0079,
      currency: 'USD',
      carrierFeeEstimate: 0.0025
    };
  }
}

module.exports = {
  sendSms,
  sendSmsBatch,
  getSmsPricing
};
