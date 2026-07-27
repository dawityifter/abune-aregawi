const crypto = require('crypto');

const OLD_ENV = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
});
afterAll(() => { process.env = OLD_ENV; });

function signBody(url, body, key) {
  return crypto.createHmac('sha256', key).update(url + body).digest('base64');
}

describe('squareClient.verifySquareSignature', () => {
  it('accepts a correctly signed body', () => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'test_key';
    process.env.SQUARE_WEBHOOK_URL = 'https://example.org/api/square/webhook';
    const { verifySquareSignature } = require('../../services/squareClient');
    const body = JSON.stringify({ hello: 'world' });
    const sig = signBody(process.env.SQUARE_WEBHOOK_URL, body, 'test_key');
    expect(verifySquareSignature(body, sig)).toBe(true);
  });

  it('rejects a tampered body', () => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'test_key';
    process.env.SQUARE_WEBHOOK_URL = 'https://example.org/api/square/webhook';
    const { verifySquareSignature } = require('../../services/squareClient');
    const sig = signBody(process.env.SQUARE_WEBHOOK_URL, '{"a":1}', 'test_key');
    expect(verifySquareSignature('{"a":2}', sig)).toBe(false);
  });

  it('rejects when signature header is missing', () => {
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'test_key';
    process.env.SQUARE_WEBHOOK_URL = 'https://example.org/api/square/webhook';
    const { verifySquareSignature } = require('../../services/squareClient');
    expect(verifySquareSignature('{"a":1}', undefined)).toBe(false);
  });
});

describe('squareClient.normalizeSquarePayment', () => {
  it('maps a COMPLETED payment to column values (minor units -> dollars)', () => {
    const { normalizeSquarePayment } = require('../../services/squareClient');
    const out = normalizeSquarePayment({
      id: 'sqpmt_1',
      status: 'COMPLETED',
      order_id: 'ord_1',
      location_id: 'LOC1',
      created_at: '2026-07-26T12:00:00Z',
      amount_money: { amount: 2500, currency: 'USD' },
      note: 'coffee hour',
      buyer_email_address: 'a@b.org',
      shipping_address: { name: 'Jane Doe' },
      card_details: { card: { card_brand: 'VISA', last_4: '1111' } }
    });
    expect(out.square_payment_id).toBe('sqpmt_1');
    expect(out.amount).toBe(25.00);
    expect(out.currency).toBe('USD');
    expect(out.buyer_email).toBe('a@b.org');
    expect(out.card_brand).toBe('VISA');
    expect(out.card_last4).toBe('1111');
    expect(out.status).toBe('COMPLETED');
  });

  it('returns null when the payment has no id', () => {
    const { normalizeSquarePayment } = require('../../services/squareClient');
    expect(normalizeSquarePayment({ status: 'COMPLETED' })).toBeNull();
  });
});
