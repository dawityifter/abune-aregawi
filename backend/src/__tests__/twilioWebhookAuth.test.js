process.env.NODE_ENV = 'test';
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
// Pinned so the URL the middleware signs over is deterministic, rather than
// depending on the ephemeral port supertest happens to pick.
process.env.PUBLIC_API_BASE_URL = 'https://api.test.example';

const request = require('supertest');
const twilio = require('twilio');

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn(), applicationDefault: jest.fn() },
  auth: () => ({ verifyIdToken: jest.fn() }),
}));

jest.mock('../models', () => {
  const Voicemail = { create: jest.fn().mockResolvedValue({ id: 1 }), findOne: jest.fn(), findByPk: jest.fn() };
  const Member = { findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn().mockResolvedValue([]) };
  const sequelize = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    showAllSchemas: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return { Voicemail, Member, sequelize };
});

const { Voicemail } = require('../models');
const app = require('../server');

const sign = (url, params) =>
  twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, params);

/**
 * These three webhooks were mounted with the comment "for now open POSt" and
 * no verification of any kind. Anyone who learned the path could invent a
 * voicemail — attacker-chosen caller number and recording URL — and set off
 * the notification that goes to leadership.
 */
describe('Twilio webhooks require a valid signature', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses a recording callback with no signature', async () => {
    const res = await request(app)
      .post('/api/twilio/voice/recording')
      .type('form')
      .send({ From: '+15551234567', RecordingUrl: 'https://evil.test/fake', CallSid: 'CA1' });

    expect(res.status).toBe(403);
    // The row never being written is the assertion that matters — a 403 alone
    // would not prove the forged voicemail was kept out of the database.
    expect(Voicemail.create).not.toHaveBeenCalled();
  });

  it('refuses a recording callback with a forged signature', async () => {
    const res = await request(app)
      .post('/api/twilio/voice/recording')
      .set('X-Twilio-Signature', 'obviously-not-a-real-signature')
      .type('form')
      .send({ From: '+15551234567', RecordingUrl: 'https://evil.test/fake' });

    expect(res.status).toBe(403);
    expect(Voicemail.create).not.toHaveBeenCalled();
  });

  it('refuses a signature computed over a different payload', async () => {
    // A replayed signature from one request must not authorise another.
    const url = 'https://api.test.example/api/twilio/voice/recording';
    const stale = sign(url, { From: '+15550000000', RecordingUrl: 'https://api.twilio.com/real' });

    const res = await request(app)
      .post('/api/twilio/voice/recording')
      .set('X-Twilio-Signature', stale)
      .type('form')
      .send({ From: '+15551234567', RecordingUrl: 'https://evil.test/fake' });

    expect(res.status).toBe(403);
    expect(Voicemail.create).not.toHaveBeenCalled();
  });

  it('accepts a genuinely signed recording callback', async () => {
    const url = 'https://api.test.example/api/twilio/voice/recording';
    const params = { From: '+15551234567', RecordingUrl: 'https://api.twilio.com/real', RecordingDuration: '12' };

    const res = await request(app)
      .post('/api/twilio/voice/recording')
      .set('X-Twilio-Signature', sign(url, params))
      .type('form')
      .send(params);

    expect(res.status).toBe(200);
    expect(Voicemail.create).toHaveBeenCalled();
  });

  it('accepts a genuinely signed incoming call and answers with TwiML', async () => {
    const url = 'https://api.test.example/api/twilio/voice';
    const params = { From: '+15551234567', CallSid: 'CA2' };

    const res = await request(app)
      .post('/api/twilio/voice')
      .set('X-Twilio-Signature', sign(url, params))
      .type('form')
      .send(params);

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Response>');
  });
});
