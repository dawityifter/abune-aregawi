const crypto = require('crypto');
const request = require('supertest');
const express = require('express');

process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'test_key';
process.env.SQUARE_WEBHOOK_URL = 'https://example.org/api/square/webhook';

const { sequelize, SquarePayment } = require('../../models');
const squareController = require('../../controllers/squareController');

function buildApp() {
  const app = express();
  // Mirror server.js: raw body for the webhook, before any json parser.
  app.post('/api/square/webhook', express.raw({ type: 'application/json' }), squareController.handleWebhook);
  return app;
}

function sign(url, body) {
  return crypto.createHmac('sha256', 'test_key').update(url + body).digest('base64');
}

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => {
  try { await sequelize.close(); } catch (e) { /* already closed by global teardown */ }
});

describe('POST /api/square/webhook', () => {
  it('rejects an invalid signature with 400 and writes nothing', async () => {
    const app = buildApp();
    const body = JSON.stringify({ type: 'payment.created', data: { object: { payment: { id: 'x', status: 'COMPLETED', amount_money: { amount: 100, currency: 'USD' } } } } });
    await request(app)
      .post('/api/square/webhook')
      .set('x-square-hmacsha256-signature', 'WRONG')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
    expect(await SquarePayment.count()).toBe(0);
  });

  it('ingests a COMPLETED payment on a valid signature', async () => {
    const app = buildApp();
    const url = process.env.SQUARE_WEBHOOK_URL;
    const body = JSON.stringify({
      type: 'payment.created',
      data: { object: { payment: {
        id: 'sqpmt_HOOK_1', status: 'COMPLETED', location_id: 'LOC1',
        created_at: '2026-07-26T12:00:00Z', amount_money: { amount: 3000, currency: 'USD' }
      } } }
    });
    await request(app)
      .post('/api/square/webhook')
      .set('x-square-hmacsha256-signature', sign(url, body))
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);
    const row = await SquarePayment.findOne({ where: { square_payment_id: 'sqpmt_HOOK_1' } });
    expect(row).toBeTruthy();
    expect(Number(row.amount)).toBe(30.00);
  });

  it('acknowledges a refund event without writing a payment row', async () => {
    const app = buildApp();
    const url = process.env.SQUARE_WEBHOOK_URL;
    const body = JSON.stringify({ type: 'refund.created', data: { object: { refund: { id: 'ref_1' } } } });
    await request(app)
      .post('/api/square/webhook')
      .set('x-square-hmacsha256-signature', sign(url, body))
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);
    expect(await SquarePayment.count({ where: { square_payment_id: 'ref_1' } })).toBe(0);
  });
});
