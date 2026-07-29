const crypto = require('crypto');
const request = require('supertest');
const express = require('express');

process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'test_key';
process.env.SQUARE_WEBHOOK_URL = 'https://example.org/api/square/webhook';

const { sequelize, SquarePayment, Member, Transaction } = require('../../models');
const squareController = require('../../controllers/squareController');

function buildApp() {
  const app = express();
  // Mirror server.js: raw body for the webhook, before any json parser.
  app.post('/api/square/webhook', express.raw({ type: 'application/json' }), squareController.handleWebhook);
  return app;
}

// Reconcile routes require auth in production (see routes/squareRoutes.js);
// tests inject req.user directly instead of exercising firebase middleware.
function buildReconcileApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.post('/api/square/reconcile/create-transaction', squareController.createTransactionFromReview);
  app.get('/api/square/queue', squareController.getQueue);
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

describe('POST /api/square/reconcile/create-transaction (server-authoritative amount/date)', () => {
  it('ignores a tampered client amount/payment_date and records the STORED SquarePayment values', async () => {
    const collector = await Member.create({
      first_name: 'Rev', last_name: 'Iewer', phone_number: '+15550009001', role: 'treasurer'
    });
    const member = await Member.create({
      first_name: 'Pay', last_name: 'Er', phone_number: '+15550009002', role: 'member'
    });
    await SquarePayment.create({
      square_payment_id: 'sqpmt_TAMPER',
      amount: 55.00,
      currency: 'USD',
      status: 'NEEDS_REVIEW',
      square_created_at: new Date('2026-07-20T10:00:00Z')
    });

    const app = buildReconcileApp({ id: collector.id });
    const res = await request(app)
      .post('/api/square/reconcile/create-transaction')
      .send({
        square_payment_id: 'sqpmt_TAMPER',
        amount: 999999.99, // tampered — must be ignored
        payment_date: '2099-01-01', // tampered — must be ignored
        member_id: member.id,
        payment_type: 'donation',
        receipt_number: '000'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const tx = await Transaction.findByPk(res.body.id);
    expect(Number(tx.amount)).toBe(55.00);
    expect(tx.payment_date).toBe('2026-07-20');

    const row = await SquarePayment.findOne({ where: { square_payment_id: 'sqpmt_TAMPER' } });
    expect(row.status).toBe('CREATED');
    expect(row.transaction_id).toBe(tx.id);
  });

  it('refuses to reconcile a square_payment_id with no ingested SquarePayment row', async () => {
    const collector = await Member.create({
      first_name: 'Rev2', last_name: 'Iewer2', phone_number: '+15550009003', role: 'treasurer'
    });
    const app = buildReconcileApp({ id: collector.id });
    const res = await request(app)
      .post('/api/square/reconcile/create-transaction')
      .send({
        square_payment_id: 'sqpmt_NEVER_INGESTED',
        amount: 10,
        payment_date: '2026-07-20',
        payment_type: 'donation',
        receipt_number: '000'
      })
      .expect(200);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Unknown Square payment');
    expect(await Transaction.count({ where: { external_id: 'square:sqpmt_NEVER_INGESTED' } })).toBe(0);
  });
});

describe('POST /api/square/reconcile/create-transaction (self-heal on pre-existing transaction)', () => {
  it('links a stranded pending row to its existing transaction and reports alreadyExisted instead of a 409 dead-end', async () => {
    const collector = await Member.create({
      first_name: 'Rev3', last_name: 'Iewer3', phone_number: '+15550009004', role: 'treasurer'
    });
    const member = await Member.create({
      first_name: 'Self', last_name: 'Heal', phone_number: '+15550009005', role: 'member'
    });
    await SquarePayment.create({
      square_payment_id: 'sqpmt_SELFHEAL',
      amount: 40.00,
      currency: 'USD',
      status: 'NEEDS_REVIEW',
      square_created_at: new Date('2026-07-21T10:00:00Z')
    });

    const app = buildReconcileApp({ id: collector.id });

    // First confirm: creates the transaction and marks the row CREATED.
    const first = await request(app)
      .post('/api/square/reconcile/create-transaction')
      .send({ square_payment_id: 'sqpmt_SELFHEAL', member_id: member.id, payment_type: 'donation', receipt_number: '000' })
      .expect(200);
    expect(first.body.success).toBe(true);
    const txId = first.body.id;

    // Simulate a stranded state: the transaction still exists, but the queue
    // row got reset back to pending (e.g. manual DB surgery, or a re-ingest).
    await SquarePayment.update(
      { status: 'NEEDS_REVIEW', transaction_id: null },
      { where: { square_payment_id: 'sqpmt_SELFHEAL' } }
    );

    // Second confirm: must self-heal, not 409-dead-end.
    const second = await request(app)
      .post('/api/square/reconcile/create-transaction')
      .send({ square_payment_id: 'sqpmt_SELFHEAL', member_id: member.id, payment_type: 'donation', receipt_number: '000' })
      .expect(200);
    expect(second.body.success).toBe(true);
    expect(second.body.alreadyExisted).toBe(true);
    expect(second.body.id).toBe(txId);

    // Row is re-linked to the SAME transaction; no duplicate transaction created.
    const row = await SquarePayment.findOne({ where: { square_payment_id: 'sqpmt_SELFHEAL' } });
    expect(row.status).toBe('CREATED');
    expect(row.transaction_id).toBe(txId);
    expect(await Transaction.count({ where: { external_id: 'square:sqpmt_SELFHEAL' } })).toBe(1);
  });
});

function buildQueueApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.post('/api/square/queue/:id/ignore', squareController.ignoreQueueItem);
  app.post('/api/square/queue/:id/restore', squareController.restoreQueueItem);
  return app;
}

describe('POST /api/square/queue/:id/restore (un-ignore)', () => {
  it('ignores then restores a payment back to a pending status', async () => {
    const collector = await Member.create({
      first_name: 'Rev4', last_name: 'Iewer4', phone_number: '+15550009006', role: 'treasurer'
    });
    const row = await SquarePayment.create({
      square_payment_id: 'sqpmt_RESTORE', amount: 15, currency: 'USD', status: 'NEEDS_REVIEW'
    });
    const app = buildQueueApp({ id: collector.id });

    await request(app).post(`/api/square/queue/${row.id}/ignore`).expect(200);
    expect((await SquarePayment.findByPk(row.id)).status).toBe('IGNORED');

    const res = await request(app).post(`/api/square/queue/${row.id}/restore`).expect(200);
    expect(res.body.success).toBe(true);
    const restored = await SquarePayment.findByPk(row.id);
    expect(restored.status).toBe('NEEDS_REVIEW');
    expect(restored.processed_at).toBeNull();
  });

  it('restores a matched payment to AUTO_MATCHED', async () => {
    const member = await Member.create({
      first_name: 'Mem', last_name: 'Atched', phone_number: '+15550009007', role: 'member'
    });
    const row = await SquarePayment.create({
      square_payment_id: 'sqpmt_RESTORE_MATCH', amount: 20, currency: 'USD',
      status: 'IGNORED', matched_member_id: member.id
    });
    const app = buildQueueApp({ id: 1 });
    const res = await request(app).post(`/api/square/queue/${row.id}/restore`).expect(200);
    expect(res.body.status).toBe('AUTO_MATCHED');
    expect((await SquarePayment.findByPk(row.id)).status).toBe('AUTO_MATCHED');
  });

  it('refuses to restore a payment that is not ignored', async () => {
    const row = await SquarePayment.create({
      square_payment_id: 'sqpmt_NOT_IGNORED', amount: 30, currency: 'USD', status: 'NEEDS_REVIEW'
    });
    const app = buildQueueApp({ id: 1 });
    const res = await request(app).post(`/api/square/queue/${row.id}/restore`).expect(400);
    expect(res.body.success).toBe(false);
    expect((await SquarePayment.findByPk(row.id)).status).toBe('NEEDS_REVIEW');
  });
});

describe('GET /api/square/queue (defaults + raw exclusion)', () => {
  it('defaults to NEEDS_REVIEW/AUTO_MATCHED only and omits the raw column when no status is passed', async () => {
    await SquarePayment.create({
      square_payment_id: 'sqpmt_Q_REVIEW', amount: 10, status: 'NEEDS_REVIEW', raw: { foo: 'bar' }
    });
    await SquarePayment.create({
      square_payment_id: 'sqpmt_Q_AUTO', amount: 10, status: 'AUTO_MATCHED', raw: { foo: 'bar' }
    });
    await SquarePayment.create({
      square_payment_id: 'sqpmt_Q_IGNORED', amount: 10, status: 'IGNORED', raw: { foo: 'bar' }
    });
    await SquarePayment.create({
      square_payment_id: 'sqpmt_Q_CREATED', amount: 10, status: 'CREATED', raw: { foo: 'bar' }
    });

    const app = buildReconcileApp({ id: null });
    const res = await request(app).get('/api/square/queue').expect(200);

    const ids = res.body.items.map(i => i.square_payment_id);
    expect(ids).toEqual(expect.arrayContaining(['sqpmt_Q_REVIEW', 'sqpmt_Q_AUTO']));
    expect(ids).not.toEqual(expect.arrayContaining(['sqpmt_Q_IGNORED', 'sqpmt_Q_CREATED']));
    expect(res.body.items[0].raw).toBeUndefined();
  });

  it('returns the explicit status when one is passed, ignoring the default filter', async () => {
    const app = buildReconcileApp({ id: null });
    const res = await request(app).get('/api/square/queue?status=IGNORED').expect(200);
    const ids = res.body.items.map(i => i.square_payment_id);
    expect(ids).toEqual(['sqpmt_Q_IGNORED']);
  });
});
