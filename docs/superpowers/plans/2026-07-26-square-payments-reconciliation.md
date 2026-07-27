# Square Payments Ingest & Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Square credit-card payments via a signature-verified webhook (plus an on-demand backfill), store them in a dedicated review queue, match them to members, and let a treasurer reconcile each one into a `Transaction` + `LedgerEntry`.

**Architecture:** Mirrors the existing Zelle feature. A new `square_payments` table is the ingest queue/audit trail. A raw-body webhook (`POST /api/square/webhook`) verifies Square's HMAC-SHA256 signature and upserts rows idempotently by `square_payment_id`. A `squarePaymentService` routes matches (reusing the Zelle/bank learning matcher) and, on treasurer confirmation, creates a `Transaction` (`payment_method='credit_card'`, `external_id='square:<id>'`) + `LedgerEntry`. A `SquareReview` React page drives reconciliation. A backfill endpoint re-pulls a date range via Square's `ListPayments`.

**Tech Stack:** Node.js/Express, Sequelize (PostgreSQL prod, `sqlite::memory:` tests), Jest, React 19 + TypeScript (CRA), Tailwind, Firebase auth. No new runtime dependency is strictly required — the webhook signature is verified with Node's built-in `crypto`, and `ListPayments`/backfill uses `fetch` against the Square REST API (no SDK).

## Global Constraints

- **Never commit real member PII/financial data** into tests, fixtures, docs, or commits. All Square payloads in tests are fabricated.
- **Idempotency is mandatory:** ingest is keyed on `square_payments.square_payment_id` (unique) and transaction creation on `transactions.external_id` (existing unique index). Never drop either unique index.
- **Do not change the `Transaction` enums.** Square rides as `payment_method='credit_card'`, `external_id='square:<square_payment_id>'`.
- **Auth:** all `/api/square/*` routes except the webhook require `firebaseAuthMiddleware` + `roleMiddleware(['treasurer','admin'])`. The webhook is public but signature-verified.
- **Webhook must be mounted with `express.raw({ type: 'application/json' })` BEFORE the JSON body parser** (same pattern as `src/server.js:141` for Stripe), or signature verification breaks.
- **i18n:** every new frontend string must have both `en` and `ti` entries in `src/i18n/dictionaries.ts`.
- **Tests run with:** `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest <file>` from `backend/`.
- **Refunds are out of scope for v1:** the webhook acknowledges refund/other events with `200` and takes no action.
- **Env vars (backend):** `SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_ENV` (`sandbox`|`production`), `SQUARE_WEBHOOK_URL`.

---

## File Structure

**Backend (create):**
- `backend/src/models/SquarePayment.js` — Sequelize model for `square_payments`.
- `backend/src/database/migrations/createSquarePayments.js` — table migration (Postgres prod).
- `backend/src/services/squareClient.js` — env guard, signature verification, `ListPayments` fetch, payload normalization.
- `backend/src/services/squarePaymentService.js` — `upsertSquarePayment`, `matchSquareBuyer`, `createSquareTransaction`.
- `backend/src/controllers/squareController.js` — webhook, sync, queue, reconcile, ignore handlers.
- `backend/src/routes/squareRoutes.js` — authed `/api/square/*` routes (not the webhook).
- Tests: `backend/src/__tests__/services/squareClient.test.js`, `backend/src/__tests__/services/squarePaymentService.test.js`, `backend/src/__tests__/controllers/squareController.test.js`.

**Backend (modify):**
- `backend/src/models/index.js` — register `SquarePayment`.
- `backend/src/services/zelleTransactionService.js` — export `resolveIncomeCategory` for reuse (one-line `module.exports` change).
- `backend/src/server.js` — mount the raw-body webhook + `/api/square` router.
- `backend/env.example` — add the four `SQUARE_*` vars.
- `backend/package.json` — add `db:migrate:square` script.

**Frontend (create):**
- `frontend/src/components/admin/SquareReview.tsx` — reconciliation page.
- Test: `frontend/src/components/admin/__tests__/SquareReview.test.tsx`.

**Frontend (modify):**
- `frontend/src/i18n/dictionaries.ts` — add `square.*` strings (en + ti).
- Wherever `ZelleReview` is mounted (e.g. `frontend/src/components/admin/TreasurerDashboard.tsx`) — add a Square tab/route alongside it.

---

## Task 1: `SquarePayment` model + migration + registration

**Files:**
- Create: `backend/src/models/SquarePayment.js`
- Create: `backend/src/database/migrations/createSquarePayments.js`
- Modify: `backend/src/models/index.js` (register model)
- Modify: `backend/package.json` (add `db:migrate:square` script)
- Test: `backend/src/__tests__/models/squarePayment.test.js`

**Interfaces:**
- Produces: `SquarePayment` Sequelize model with fields `square_payment_id` (unique), `order_id`, `location_id`, `amount`, `currency`, `square_created_at`, `buyer_name`, `buyer_email`, `note`, `card_brand`, `card_last4`, `status`, `matched_member_id`, `match_confidence`, `match_source`, `transaction_id`, `raw`, `processed_at`, `error`. Associations: `belongsTo(Member, as: 'matchedMember', foreignKey: 'matched_member_id')`, `belongsTo(Transaction, as: 'transaction', foreignKey: 'transaction_id')`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/models/squarePayment.test.js`:

```javascript
const { SquarePayment, sequelize } = require('../../models');

describe('SquarePayment model', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });
  afterAll(async () => { await sequelize.close(); });

  it('creates a row and defaults status to NEEDS_REVIEW', async () => {
    const row = await SquarePayment.create({
      square_payment_id: 'sqpmt_TEST_1',
      amount: 25.00,
      currency: 'USD',
      square_created_at: new Date('2026-07-26T12:00:00Z')
    });
    expect(row.id).toBeTruthy();
    expect(row.status).toBe('NEEDS_REVIEW');
  });

  it('enforces a unique square_payment_id', async () => {
    await SquarePayment.create({ square_payment_id: 'sqpmt_DUP', amount: 5, currency: 'USD' });
    await expect(
      SquarePayment.create({ square_payment_id: 'sqpmt_DUP', amount: 6, currency: 'USD' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/models/squarePayment.test.js`
Expected: FAIL — `SquarePayment` is undefined (not registered).

- [ ] **Step 3: Create the model**

Create `backend/src/models/SquarePayment.js`:

```javascript
module.exports = (sequelize) => {
  const { DataTypes, Model } = require('sequelize');

  /**
   * Persistent record of every Square payment seen by the webhook or backfill.
   * Ingest queue + audit trail, mirroring zelle_email_queue.
   *
   * status:
   *  - NEEDS_REVIEW : ingested, no confident match (default; POS taps land here)
   *  - AUTO_MATCHED : ingested with a confident learned match; awaits treasurer confirm
   *  - CREATED      : treasurer confirmed; a Transaction exists (transaction_id set)
   *  - IGNORED      : treasurer dismissed this payment
   *  - REFUNDED     : reserved for the future refunds phase (not written in v1)
   *  - ERROR        : processing failed (see error column)
   */
  class SquarePayment extends Model {
    static associate(models) {
      SquarePayment.belongsTo(models.Member, {
        foreignKey: 'matched_member_id',
        as: 'matchedMember'
      });
      SquarePayment.belongsTo(models.Transaction, {
        foreignKey: 'transaction_id',
        as: 'transaction'
      });
    }
  }

  SquarePayment.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    square_payment_id: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    order_id: { type: DataTypes.STRING(191), allowNull: true },
    location_id: { type: DataTypes.STRING(64), allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: true },
    square_created_at: { type: DataTypes.DATE, allowNull: true },
    buyer_name: { type: DataTypes.STRING(255), allowNull: true },
    buyer_email: { type: DataTypes.STRING(255), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    card_brand: { type: DataTypes.STRING(40), allowNull: true },
    card_last4: { type: DataTypes.STRING(8), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'NEEDS_REVIEW' },
    matched_member_id: { type: DataTypes.BIGINT, allowNull: true },
    match_confidence: { type: DataTypes.STRING(20), allowNull: true },
    match_source: { type: DataTypes.STRING(60), allowNull: true },
    transaction_id: { type: DataTypes.BIGINT, allowNull: true },
    raw: { type: DataTypes.JSONB, allowNull: true },
    processed_at: { type: DataTypes.DATE, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'SquarePayment',
    tableName: 'square_payments',
    underscored: true,
    indexes: [
      { unique: true, fields: ['square_payment_id'] },
      { fields: ['status'] },
      { fields: ['matched_member_id'] }
    ]
  });

  return SquarePayment;
};
```

> **sqlite note:** `DataTypes.JSONB` maps to TEXT/JSON on sqlite automatically in Sequelize, so the test suite works unchanged.

- [ ] **Step 4: Register the model in `index.js`**

In `backend/src/models/index.js`, after the `const MemberLoan = require('./MemberLoan')(sequelize);` line (~121), add:

```javascript
  const SquarePayment = require('./SquarePayment')(sequelize);
```

Then inside the `const models = { ... }` object, after `MemberLoan`, add `SquarePayment`:

```javascript
    MemberLoan,
    SquarePayment
```

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/models/squarePayment.test.js`
Expected: PASS (both tests).

- [ ] **Step 6: Create the production migration**

Create `backend/src/database/migrations/createSquarePayments.js`:

```javascript
const { sequelize } = require('../../models');

async function createSquarePayments() {
  try {
    console.log('Creating square_payments table...');
    await sequelize.query(`SET search_path TO public;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS square_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        square_payment_id VARCHAR(191) NOT NULL UNIQUE,
        order_id VARCHAR(191),
        location_id VARCHAR(64),
        amount NUMERIC(10,2),
        currency VARCHAR(3),
        square_created_at TIMESTAMPTZ,
        buyer_name VARCHAR(255),
        buyer_email VARCHAR(255),
        note TEXT,
        card_brand VARCHAR(40),
        card_last4 VARCHAR(8),
        status VARCHAR(20) NOT NULL DEFAULT 'NEEDS_REVIEW',
        matched_member_id BIGINT,
        match_confidence VARCHAR(20),
        match_source VARCHAR(60),
        transaction_id BIGINT,
        raw JSONB,
        processed_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS square_payments_status_idx ON square_payments(status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS square_payments_matched_member_id_idx ON square_payments(matched_member_id);`);
    console.log('✅ square_payments table created');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  createSquarePayments()
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((error) => { console.error('❌ Error:', error); process.exit(1); });
}

module.exports = createSquarePayments;
```

- [ ] **Step 7: Add the migration npm script**

In `backend/package.json` scripts, after the `"db:migrate:ledger-types"` line, add:

```json
    "db:migrate:square": "node src/database/migrations/createSquarePayments.js",
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/models/SquarePayment.js backend/src/models/index.js backend/src/database/migrations/createSquarePayments.js backend/package.json backend/src/__tests__/models/squarePayment.test.js
git commit -m "feat(square): add square_payments model and migration"
```

---

## Task 2: Square client — signature verification, config guard, ListPayments, payload normalization

**Files:**
- Create: `backend/src/services/squareClient.js`
- Test: `backend/src/__tests__/services/squareClient.test.js`

**Interfaces:**
- Consumes: env vars `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL`, `SQUARE_ACCESS_TOKEN`, `SQUARE_ENV`.
- Produces:
  - `isSquareConfigured(): boolean`
  - `verifySquareSignature(rawBody: Buffer|string, signatureHeader: string): boolean`
  - `normalizeSquarePayment(payment: object): { square_payment_id, order_id, location_id, amount, currency, square_created_at, buyer_name, buyer_email, note, card_brand, card_last4, status } | null` — converts a Square payment object into `square_payments` column values; returns `null` if the payment id is missing.
  - `listSquarePayments({ beginTime, endTime }): Promise<object[]>` — array of raw Square payment objects.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/services/squareClient.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/squareClient.test.js`
Expected: FAIL — cannot find module `../../services/squareClient`.

- [ ] **Step 3: Create the client**

Create `backend/src/services/squareClient.js`:

```javascript
/**
 * Square integration helpers: config guard, webhook signature verification,
 * payment normalization, and the ListPayments backfill fetch. No SDK — uses
 * Node's built-in crypto and global fetch against the Square REST API.
 */
const crypto = require('crypto');

function isSquareConfigured() {
  return Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && process.env.SQUARE_WEBHOOK_URL);
}

/**
 * Square signs (notification URL + raw request body) with HMAC-SHA256 using the
 * webhook signature key, base64-encoded, sent in the
 * `x-square-hmacsha256-signature` header. Constant-time compare.
 */
function verifySquareSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const url = process.env.SQUARE_WEBHOOK_URL;
  if (!key || !url) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', key).update(url + body).digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Map a Square payment object to square_payments column values.
 * Returns null when there is no payment id.
 */
function normalizeSquarePayment(payment) {
  if (!payment || !payment.id) return null;
  const amountMoney = payment.amount_money || {};
  const cardDetails = payment.card_details || {};
  const card = cardDetails.card || {};
  const buyerName =
    (payment.shipping_address && payment.shipping_address.name) ||
    (payment.billing_address && payment.billing_address.name) ||
    null;

  return {
    square_payment_id: payment.id,
    order_id: payment.order_id || null,
    location_id: payment.location_id || null,
    amount: typeof amountMoney.amount === 'number' ? amountMoney.amount / 100.0 : null,
    currency: amountMoney.currency || null,
    square_created_at: payment.created_at ? new Date(payment.created_at) : null,
    buyer_name: buyerName,
    buyer_email: payment.buyer_email_address || null,
    note: payment.note || null,
    card_brand: card.card_brand || null,
    card_last4: card.last_4 || null,
    status: payment.status || null
  };
}

function squareApiBase() {
  return process.env.SQUARE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

/**
 * Fetch payments in a time window via the Square REST API (paginated).
 * Throws if SQUARE_ACCESS_TOKEN is not set.
 */
async function listSquarePayments({ beginTime, endTime }) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not configured');

  const results = [];
  let cursor = null;
  do {
    const params = new URLSearchParams();
    if (beginTime) params.set('begin_time', beginTime);
    if (endTime) params.set('end_time', endTime);
    if (cursor) params.set('cursor', cursor);

    const resp = await fetch(`${squareApiBase()}/v2/payments?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Square ListPayments failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    if (Array.isArray(data.payments)) results.push(...data.payments);
    cursor = data.cursor || null;
  } while (cursor);

  return results;
}

module.exports = {
  isSquareConfigured,
  verifySquareSignature,
  normalizeSquarePayment,
  listSquarePayments
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/squareClient.test.js`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/squareClient.js backend/src/__tests__/services/squareClient.test.js
git commit -m "feat(square): add square client (signature verify, normalize, ListPayments)"
```

---

## Task 3: `squarePaymentService` — upsert/ingest, buyer matching, transaction creation

**Files:**
- Create: `backend/src/services/squarePaymentService.js`
- Modify: `backend/src/services/zelleTransactionService.js` (export `resolveIncomeCategory`)
- Test: `backend/src/__tests__/services/squarePaymentService.test.js`

**Interfaces:**
- Consumes: `normalizeSquarePayment` (Task 2); `findSuggestionCandidates`, `learnBankMemoMatch` from `bankMemoMatchService`; `resolveIncomeCategory` from `zelleTransactionService`; `validateReceiptNumber` from `utils/receiptNumber`.
- Produces:
  - `upsertSquarePayment(paymentObj): Promise<{ row, created }>` — normalizes + upserts by `square_payment_id`, then runs matching (sets `AUTO_MATCHED` or leaves `NEEDS_REVIEW`). Skips non-`COMPLETED` payments (returns `{ row: null, created: false }`).
  - `matchSquareBuyer({ buyer_name, buyer_email, note }): Promise<{ member_id, member_name, confidence, source }>`
  - `createSquareTransaction({ square_payment_id, amount, payment_date, note, member_id, payment_type, for_year, receipt_number, buyer_name }, collectedBy): Promise<{ success, id, data } | { success:false, code:'EXISTS', id }>`

- [ ] **Step 1: Export `resolveIncomeCategory` from the Zelle service**

In `backend/src/services/zelleTransactionService.js`, add `resolveIncomeCategory` to the `module.exports` object (it is already defined in that file). The exports block becomes:

```javascript
module.exports = {
  sanitizeNote,
  extractPayerName,
  extractZelleReference,
  buildZelleExternalId,
  cleanLegacyMemo,
  matchZelleSender,
  learnZelleAssociation,
  getDefaultPaymentType,
  createZelleTransaction,
  resolveIncomeCategory
};
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/__tests__/services/squarePaymentService.test.js`:

```javascript
const { sequelize, SquarePayment, Member, Transaction, LedgerEntry } = require('../../models');
const {
  upsertSquarePayment,
  createSquareTransaction
} = require('../../services/squarePaymentService');

let collector;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  collector = await Member.create({
    first_name: 'Col', last_name: 'Lector', phone_number: '+15550000001', role: 'treasurer'
  });
});
afterAll(async () => { await sequelize.close(); });

function completedPayment(id, over = {}) {
  return {
    id, status: 'COMPLETED', location_id: 'LOC1',
    created_at: '2026-07-26T12:00:00Z',
    amount_money: { amount: 4000, currency: 'USD' },
    ...over
  };
}

describe('upsertSquarePayment', () => {
  it('inserts a COMPLETED payment as NEEDS_REVIEW and is idempotent', async () => {
    const first = await upsertSquarePayment(completedPayment('sqpmt_A'));
    expect(first.created).toBe(true);
    expect(first.row.status).toBe('NEEDS_REVIEW');

    const second = await upsertSquarePayment(completedPayment('sqpmt_A'));
    expect(second.created).toBe(false);
    const count = await SquarePayment.count({ where: { square_payment_id: 'sqpmt_A' } });
    expect(count).toBe(1);
  });

  it('skips non-COMPLETED payments', async () => {
    const res = await upsertSquarePayment(completedPayment('sqpmt_PENDING', { status: 'PENDING' }));
    expect(res.row).toBeNull();
    const count = await SquarePayment.count({ where: { square_payment_id: 'sqpmt_PENDING' } });
    expect(count).toBe(0);
  });
});

describe('createSquareTransaction', () => {
  it('creates a credit_card Transaction + LedgerEntry keyed by square: external_id', async () => {
    const member = await Member.create({
      first_name: 'Mem', last_name: 'Ber', phone_number: '+15550000002', role: 'member'
    });
    const res = await createSquareTransaction({
      square_payment_id: 'sqpmt_TX',
      amount: 40.00,
      payment_date: '2026-07-26',
      note: 'donation',
      member_id: member.id,
      payment_type: 'donation'
    }, collector.id);

    expect(res.success).toBe(true);
    const tx = await Transaction.findByPk(res.id);
    expect(tx.payment_method).toBe('credit_card');
    expect(tx.external_id).toBe('square:sqpmt_TX');
    const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
    expect(ledger).toBeTruthy();
  });

  it('is insert-only: a duplicate square_payment_id returns EXISTS', async () => {
    const res = await createSquareTransaction({
      square_payment_id: 'sqpmt_TX',
      amount: 40.00,
      payment_date: '2026-07-26',
      payment_type: 'donation'
    }, collector.id);
    expect(res.success).toBe(false);
    expect(res.code).toBe('EXISTS');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/squarePaymentService.test.js`
Expected: FAIL — cannot find module `../../services/squarePaymentService`.

- [ ] **Step 4: Create the service**

Create `backend/src/services/squarePaymentService.js`:

```javascript
/**
 * Square payment ingest + reconciliation logic. Mirrors zelleTransactionService
 * but for Square: rides on transactions as payment_method='credit_card' with
 * external_id='square:<square_payment_id>'.
 */
const { Op } = require('sequelize');
const {
  Member, Transaction, SquarePayment, LedgerEntry
} = require('../models');
const { normalizeSquarePayment } = require('./squareClient');
const { findSuggestionCandidates, learnBankMemoMatch } = require('./bankMemoMatchService');
const { resolveIncomeCategory } = require('./zelleTransactionService');
const { validateReceiptNumber } = require('../utils/receiptNumber');

function externalIdFor(squarePaymentId) {
  return `square:${squarePaymentId}`;
}

/**
 * Match a Square buyer to a member.
 * 1. Exact email match on Member.email (high confidence).
 * 2. Learned/fuzzy name match via the shared bank/Zelle suggestion engine.
 * Returns { member_id, member_name, confidence, source }.
 */
async function matchSquareBuyer({ buyer_name, buyer_email, note }) {
  const result = { member_id: null, member_name: null, confidence: null, source: null };

  if (buyer_email) {
    const byEmail = await Member.findOne({
      where: { email: buyer_email },
      attributes: ['id', 'first_name', 'last_name']
    });
    if (byEmail) {
      result.member_id = byEmail.id;
      result.member_name = `${byEmail.first_name || ''} ${byEmail.last_name || ''}`.trim();
      result.confidence = 'high';
      result.source = 'SQUARE_EMAIL';
      return result;
    }
  }

  if (buyer_name) {
    const pseudoTxn = {
      type: 'SQUARE',
      payer_name: buyer_name,
      description: `Square payment from ${buyer_name} 0000000`
    };
    const suggestions = await findSuggestionCandidates(pseudoTxn);
    const learned = suggestions.find(
      s => s.confidence === 'high' && String(s.source || '').startsWith('LEARNED') && s.member?.id
    );
    if (learned) {
      result.member_id = learned.member.id;
      result.member_name = `${learned.member.first_name || ''} ${learned.member.last_name || ''}`.trim();
      result.confidence = 'high';
      result.source = learned.source;
      return result;
    }
    const unique = suggestions.filter(s => s.member?.id);
    if (unique.length === 1) {
      result.member_id = unique[0].member.id;
      result.member_name = `${unique[0].member.first_name || ''} ${unique[0].member.last_name || ''}`.trim();
      result.confidence = 'medium';
      result.source = unique[0].source;
    }
  }

  return result;
}

/**
 * Normalize + upsert a Square payment by square_payment_id, then attempt a match.
 * Only COMPLETED payments are stored. Returns { row, created }.
 */
async function upsertSquarePayment(paymentObj) {
  const fields = normalizeSquarePayment(paymentObj);
  if (!fields || fields.status !== 'COMPLETED') {
    return { row: null, created: false };
  }

  const match = await matchSquareBuyer(fields);
  const statusFromMatch = match.confidence === 'high' ? 'AUTO_MATCHED' : 'NEEDS_REVIEW';

  const [row, created] = await SquarePayment.findOrCreate({
    where: { square_payment_id: fields.square_payment_id },
    defaults: {
      ...fields,
      raw: paymentObj,
      status: statusFromMatch,
      matched_member_id: match.member_id,
      match_confidence: match.confidence,
      match_source: match.source
    }
  });

  // On re-ingest of a not-yet-reconciled row, refresh matchable fields only.
  if (!created && ['NEEDS_REVIEW', 'AUTO_MATCHED'].includes(row.status)) {
    await row.update({
      amount: fields.amount,
      currency: fields.currency,
      square_created_at: fields.square_created_at,
      buyer_name: fields.buyer_name,
      buyer_email: fields.buyer_email,
      note: fields.note,
      card_brand: fields.card_brand,
      card_last4: fields.card_last4,
      raw: paymentObj,
      status: statusFromMatch,
      matched_member_id: match.member_id,
      match_confidence: match.confidence,
      match_source: match.source
    });
  }

  return { row, created };
}

/**
 * Create a Square Transaction + LedgerEntry (insert-only by external_id) and
 * learn the buyer association. Returns { success, id, data } or
 * { success:false, code:'EXISTS', id }.
 */
async function createSquareTransaction({
  square_payment_id, amount, payment_date, note,
  member_id, payment_type, for_year, receipt_number, buyer_name
}, collectedBy) {
  if (!square_payment_id || !amount || !payment_date) {
    throw new Error('square_payment_id, amount, and payment_date are required');
  }
  if (!collectedBy) throw new Error('Missing collector context');

  const external_id = externalIdFor(square_payment_id);

  const existing = await Transaction.findOne({ where: { external_id } });
  if (existing) {
    return { success: false, message: 'Transaction already exists for this Square payment', id: existing.id, code: 'EXISTS' };
  }

  const receiptValidation = validateReceiptNumber(receipt_number);
  if (!receiptValidation.valid) throw new Error(receiptValidation.message);
  const normalizedReceiptNumber = receiptValidation.normalized;
  if (normalizedReceiptNumber && normalizedReceiptNumber !== '000') {
    const dupReceipt = await Transaction.findOne({ where: { receipt_number: normalizedReceiptNumber } });
    if (dupReceipt) {
      throw new Error(`Receipt number "${normalizedReceiptNumber}" has already been used. Please use a unique receipt number.`);
    }
  }

  const finalPaymentType = payment_type || 'donation';
  const incomeCategory = await resolveIncomeCategory(finalPaymentType);

  const tx = await Transaction.create({
    member_id: member_id || null,
    collected_by: collectedBy,
    payment_date,
    amount,
    payment_type: finalPaymentType,
    payment_method: 'credit_card',
    status: 'succeeded',
    receipt_number: normalizedReceiptNumber || null,
    note: note || null,
    external_id,
    donation_id: null,
    income_category_id: incomeCategory?.id || null,
    for_year: for_year || null
  });

  if (member_id && buyer_name) {
    try {
      await learnBankMemoMatch(
        { id: null, type: 'SQUARE', payer_name: buyer_name, description: `Square payment from ${buyer_name} 0000000` },
        member_id
      );
    } catch (e) {
      console.warn('Square learn association warning:', e.message || e);
    }
  }

  try {
    const glCode = incomeCategory?.gl_code || 'INC999';
    await LedgerEntry.create({
      type: finalPaymentType,
      category: glCode,
      amount: parseFloat(amount),
      entry_date: payment_date,
      member_id: member_id || null,
      payment_method: 'credit_card',
      receipt_number: normalizedReceiptNumber || null,
      memo: `${glCode} - Square payment ${external_id}`,
      transaction_id: tx.id
    });
  } catch (ledgerErr) {
    console.error('⚠️ Failed to create ledger entry for Square transaction:', ledgerErr.message);
  }

  return { success: true, id: tx.id, data: tx };
}

module.exports = {
  externalIdFor,
  matchSquareBuyer,
  upsertSquarePayment,
  createSquareTransaction
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/squarePaymentService.test.js`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/squarePaymentService.js backend/src/services/zelleTransactionService.js backend/src/__tests__/services/squarePaymentService.test.js
git commit -m "feat(square): add ingest/matching/transaction service"
```

---

## Task 4: Controller + routes + webhook wiring

**Files:**
- Create: `backend/src/controllers/squareController.js`
- Create: `backend/src/routes/squareRoutes.js`
- Modify: `backend/src/server.js` (mount raw webhook + `/api/square` router)
- Test: `backend/src/__tests__/controllers/squareController.test.js`

**Interfaces:**
- Consumes: `verifySquareSignature`, `isSquareConfigured`, `listSquarePayments` (Task 2); `upsertSquarePayment`, `createSquareTransaction` (Task 3).
- Produces controller handlers: `handleWebhook`, `syncFromSquare`, `getQueue`, `createTransactionFromReview`, `createBatchTransactions`, `ignoreQueueItem`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/squareController.test.js`:

```javascript
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
afterAll(async () => { await sequelize.close(); });

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
```

> **Note:** `supertest` is already a dev dependency of this backend (used by existing controller tests). If a `require('supertest')` failure occurs, install it with `npm i -D supertest` before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/squareController.test.js`
Expected: FAIL — cannot find module `../../controllers/squareController`.

- [ ] **Step 3: Create the controller**

Create `backend/src/controllers/squareController.js`:

```javascript
const {
  isSquareConfigured, verifySquareSignature, listSquarePayments
} = require('../services/squareClient');
const {
  upsertSquarePayment, createSquareTransaction
} = require('../services/squarePaymentService');
const { SquarePayment, Member, Transaction } = require('../models');

// POST /api/square/webhook  (raw body, public, signature-verified)
async function handleWebhook(req, res) {
  const signature = req.headers['x-square-hmacsha256-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw

  if (!verifySquareSignature(rawBody, signature)) {
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  try {
    if (event.type === 'payment.created' || event.type === 'payment.updated') {
      const payment = event?.data?.object?.payment;
      if (payment) await upsertSquarePayment(payment);
    } else {
      // refunds, disputes, etc. — acknowledged, no action in v1
      console.log(`Unhandled Square event type: ${event.type}`);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('Square webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// POST /api/square/sync  Body: { beginTime?, endTime? }
async function syncFromSquare(req, res) {
  try {
    if (!isSquareConfigured()) {
      return res.status(400).json({ success: false, message: 'Square is not configured' });
    }
    const { beginTime, endTime } = req.body || {};
    const payments = await listSquarePayments({ beginTime, endTime });
    let created = 0, seen = 0;
    for (const p of payments) {
      const { row, created: wasCreated } = await upsertSquarePayment(p);
      if (row) { seen += 1; if (wasCreated) created += 1; }
    }
    return res.json({ success: true, stats: { fetched: payments.length, ingested: seen, created } });
  } catch (error) {
    console.error('Square sync error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/square/queue?status=&limit=
async function getQueue(req, res) {
  try {
    const { status } = req.query;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const where = {};
    if (status) where.status = String(status).toUpperCase();
    const rows = await SquarePayment.findAll({
      where,
      order: [['square_created_at', 'DESC'], ['created_at', 'DESC']],
      limit,
      include: [
        { model: Member, as: 'matchedMember', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction', attributes: ['id', 'amount', 'payment_type', 'payment_date', 'receipt_number'] }
      ]
    });
    return res.json({ success: true, count: rows.length, items: rows });
  } catch (error) {
    console.error('Square queue list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function processReview(item, user) {
  const {
    square_payment_id, amount, payment_date, note,
    member_id, payment_type, for_year, receipt_number, buyer_name
  } = item || {};
  const collected_by = user?.id || null;
  if (!collected_by) throw new Error('Missing collector context');

  const result = await createSquareTransaction({
    square_payment_id, amount, payment_date, note,
    member_id, payment_type, for_year, receipt_number, buyer_name
  }, collected_by);

  if (result.success && square_payment_id) {
    try {
      const row = await SquarePayment.findOne({ where: { square_payment_id } });
      if (row) {
        await row.update({
          status: 'CREATED',
          transaction_id: result.id,
          matched_member_id: member_id || null,
          processed_at: new Date(),
          error: null
        });
      }
    } catch (e) {
      console.warn('Square queue update warning:', e.message || e);
    }
  }
  return result;
}

// POST /api/square/reconcile/create-transaction
async function createTransactionFromReview(req, res) {
  try {
    const result = await processReview(req.body || {}, req.user);
    if (!result.success && result.code === 'EXISTS') return res.status(409).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Square create-transaction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/square/reconcile/batch-create  Body: { items: [...] }
async function createBatchTransactions(req, res) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }
    const results = [];
    for (const item of items) {
      try {
        const result = await processReview(item, req.user);
        results.push({ ...result, square_payment_id: item.square_payment_id });
      } catch (e) {
        results.push({ success: false, message: e.message, square_payment_id: item.square_payment_id });
      }
    }
    return res.json({ success: true, results });
  } catch (error) {
    console.error('Square batch create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/square/queue/:id/ignore
async function ignoreQueueItem(req, res) {
  try {
    const row = await SquarePayment.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Queue item not found' });
    if (row.status === 'CREATED') {
      return res.status(400).json({ success: false, message: 'Cannot ignore a payment that already has a transaction' });
    }
    await row.update({ status: 'IGNORED', processed_at: new Date() });
    return res.json({ success: true });
  } catch (error) {
    console.error('Square queue ignore error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  handleWebhook,
  syncFromSquare,
  getQueue,
  createTransactionFromReview,
  createBatchTransactions,
  ignoreQueueItem
};
```

- [ ] **Step 4: Create the authed routes**

Create `backend/src/routes/squareRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const {
  syncFromSquare, getQueue, createTransactionFromReview,
  createBatchTransactions, ignoreQueueItem
} = require('../controllers/squareController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// NOTE: the webhook is mounted separately in server.js (raw body, public).
router.use(firebaseAuthMiddleware);
router.use(roleMiddleware(['treasurer', 'admin']));

router.post('/sync', syncFromSquare);
router.get('/queue', getQueue);
router.post('/reconcile/create-transaction', createTransactionFromReview);
router.post('/reconcile/batch-create', createBatchTransactions);
router.post('/queue/:id/ignore', ignoreQueueItem);

module.exports = router;
```

- [ ] **Step 5: Wire the webhook + router into `server.js`**

In `backend/src/server.js`:

(a) Immediately after the existing Stripe webhook mount at line 141:
```javascript
app.post('/api/donations/webhook', express.raw({ type: 'application/json' }), donationController.handleWebhook);
```
add:
```javascript
// Mount Square webhook BEFORE body parsers to preserve raw body for signature verification
app.post('/api/square/webhook', express.raw({ type: 'application/json' }), require('./controllers/squareController').handleWebhook);
```

(b) Near the other route requires (~line 40, by `const zelleRoutes = require('./routes/zelleRoutes');`), add:
```javascript
const squareRoutes = require('./routes/squareRoutes');
```

(c) Near the other `app.use` route mounts (~line 257, by `app.use('/api/zelle', zelleRoutes);`), add:
```javascript
app.use('/api/square', squareRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/squareController.test.js`
Expected: PASS (all 3 tests).

- [ ] **Step 7: Run the full backend suite to confirm no regressions**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest`
Expected: PASS (existing suites + the 3 new Square test files).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/squareController.js backend/src/routes/squareRoutes.js backend/src/server.js backend/src/__tests__/controllers/squareController.test.js
git commit -m "feat(square): add webhook + reconciliation controller and routes"
```

---

## Task 5: Env template + docs

**Files:**
- Modify: `backend/env.example`

- [ ] **Step 1: Add Square vars to `env.example`**

Append to `backend/env.example` (values are placeholders — never commit real keys):

```bash
# Square (credit-card payments taken outside the app)
SQUARE_ENV=sandbox                     # sandbox | production
SQUARE_ACCESS_TOKEN=                   # Square API access token (for ListPayments backfill)
SQUARE_WEBHOOK_SIGNATURE_KEY=          # Webhook subscription signature key (HMAC verify)
SQUARE_WEBHOOK_URL=                    # Exact notification URL Square is configured to call
```

- [ ] **Step 2: Commit**

```bash
git add backend/env.example
git commit -m "chore(square): document Square env vars"
```

---

## Task 6: Frontend reconciliation page + i18n + nav

**Files:**
- Create: `frontend/src/components/admin/SquareReview.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts` (add `square.*` en + ti)
- Modify: `frontend/src/components/admin/TreasurerDashboard.tsx` (add Square tab/section — confirm exact mount point where `ZelleReview` is used)
- Test: `frontend/src/components/admin/__tests__/SquareReview.test.tsx`

**Interfaces:**
- Consumes backend endpoints: `GET /api/square/queue`, `POST /api/square/sync`, `POST /api/square/reconcile/create-transaction`, `POST /api/square/queue/:id/ignore`, and `GET /api/members/search` (existing member search used by ZelleReview — confirm its exact path in `ZelleReview.tsx` and reuse it verbatim).
- Produces: `SquareReview` default-exported React component.

- [ ] **Step 1: Confirm the member-search endpoint and auth-token pattern**

Read `frontend/src/components/admin/ZelleReview.tsx` for: (a) how it builds the auth header (Firebase `getIdToken`), and (b) the exact member search URL. Reuse both verbatim in `SquareReview` so behavior matches. Record the search URL here before coding.

- [ ] **Step 2: Add i18n strings**

In `frontend/src/i18n/dictionaries.ts`, add to both the `en` and `ti` dictionaries a `square` section. English:

```typescript
square: {
  title: 'Square Payments',
  sync: 'Sync from Square',
  from: 'From',
  to: 'To',
  status: 'Status',
  amount: 'Amount',
  buyer: 'Buyer',
  note: 'Note',
  matchedMember: 'Matched member',
  searchMember: 'Search member…',
  paymentType: 'Payment type',
  year: 'Year',
  receipt: 'Receipt #',
  confirm: 'Confirm',
  ignore: 'Ignore',
  noneToReview: 'No Square payments to review.',
  createdOk: 'Transaction created.',
  ignoredOk: 'Payment ignored.'
}
```

Tigrigna (draft — flag for native review, consistent with the project's i18n process):

```typescript
square: {
  title: 'ክፍሊት ስኴር',
  sync: 'ካብ ስኴር ኣምጽእ',
  from: 'ካብ',
  to: 'ናብ',
  status: 'ኩነታት',
  amount: 'መጠን',
  buyer: 'ገዛኢ',
  note: 'መዘኻኸሪ',
  matchedMember: 'እተዛመደ ኣባል',
  searchMember: 'ኣባል ድለ…',
  paymentType: 'ዓይነት ክፍሊት',
  year: 'ዓመት',
  receipt: 'ቁ. ደረሰ',
  confirm: 'ኣረጋግጽ',
  ignore: 'ሸለል በል',
  noneToReview: 'ንግምጋም ዝኸውን ክፍሊት ስኴር የለን።',
  createdOk: 'ሸማ ተፈጢሩ።',
  ignoredOk: 'ክፍሊት ተሸለለ።'
}
```

- [ ] **Step 3: Write the failing test**

Create `frontend/src/components/admin/__tests__/SquareReview.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SquareReview from '../SquareReview';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { email: 'treasurer@test.org' },
    firebaseUser: { getIdToken: async () => 'test-token' }
  })
}));
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k })
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      items: [{
        id: 'row-1',
        square_payment_id: 'sqpmt_1',
        amount: '30.00',
        buyer_name: 'Jane Doe',
        status: 'NEEDS_REVIEW'
      }]
    })
  }) as any;
});

it('renders a Square payment row from the queue', async () => {
  render(<SquareReview />);
  await waitFor(() => expect(screen.getByText(/Jane Doe/)).toBeInTheDocument());
});
```

- [ ] **Step 4: Run test to verify it fails**

Run (from `frontend/`): `CI=true npx react-scripts test src/components/admin/__tests__/SquareReview.test.tsx --watchAll=false`
Expected: FAIL — cannot find module `../SquareReview`.

- [ ] **Step 5: Create the component**

Create `frontend/src/components/admin/SquareReview.tsx`. Model it on `ZelleReview.tsx` (row list, per-row member search, payment-type/year/receipt inputs, confirm, ignore, plus a date-range "Sync from Square"). Use the exact auth-header and member-search URL captured in Step 1. Minimum viable, complete implementation:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface SquareRow {
  id: string;
  square_payment_id: string;
  amount?: string | number | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  note?: string | null;
  square_created_at?: string | null;
  status: string;
  matched_member_id?: number | null;
  matchedMember?: { id: number; first_name?: string; last_name?: string } | null;
}
interface SearchResult { id: number; name: string; phoneNumber?: string | null; }

const PAYMENT_TYPES = ['donation', 'membership_due', 'tithe', 'offering', 'building_fund', 'event', 'other'];

const SquareReview: React.FC = () => {
  const { firebaseUser, currentUser } = useAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<SquareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [beginTime, setBeginTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [rowSearch, setRowSearch] = useState<Record<string, { query: string; results: SearchResult[]; selectedId?: number }>>({});
  const [rowType, setRowType] = useState<Record<string, string>>({});
  const [rowYear, setRowYear] = useState<Record<string, string>>({});
  const [rowReceipt, setRowReceipt] = useState<Record<string, string>>({});
  const currentYear = new Date().getFullYear();

  const authHeader = useCallback(async () => {
    const token = firebaseUser ? await firebaseUser.getIdToken() : '';
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, [firebaseUser]);

  const fetchQueue = useCallback(async () => {
    if (!firebaseUser || !currentUser?.email) return;
    setLoading(true); setError('');
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/queue?limit=100`, { headers });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Failed to load queue');
      setRows(data.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load Square payments');
    } finally { setLoading(false); }
  }, [firebaseUser, currentUser, authHeader]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const runSync = async () => {
    setLoading(true); setError('');
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/sync`, {
        method: 'POST', headers, body: JSON.stringify({ beginTime: beginTime || undefined, endTime: endTime || undefined })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Sync failed');
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Sync failed');
    } finally { setLoading(false); }
  };

  const searchMember = async (rowId: string, query: string) => {
    setRowSearch(s => ({ ...s, [rowId]: { ...(s[rowId] || { results: [] }), query } }));
    if (query.trim().length < 2) return;
    const headers = await authHeader();
    // NOTE: reuse the exact member-search URL from ZelleReview (captured in Step 1).
    const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/members/search?q=${encodeURIComponent(query)}`, { headers });
    const data = await resp.json();
    const results: SearchResult[] = (data.results || []).map((r: any) => ({ id: r.id, name: r.name, phoneNumber: r.phoneNumber }));
    setRowSearch(s => ({ ...s, [rowId]: { ...(s[rowId] || { query: '' }), query, results } }));
  };

  const confirmRow = async (row: SquareRow) => {
    const rs = rowSearch[row.id];
    const memberId = rs?.selectedId ?? row.matched_member_id ?? undefined;
    setBusyIds(b => ({ ...b, [row.id]: true }));
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/reconcile/create-transaction`, {
        method: 'POST', headers, body: JSON.stringify({
          square_payment_id: row.square_payment_id,
          amount: row.amount,
          payment_date: (row.square_created_at || new Date().toISOString()).slice(0, 10),
          note: row.note,
          buyer_name: row.buyer_name,
          member_id: memberId ?? null,
          payment_type: rowType[row.id] || 'donation',
          for_year: (rowType[row.id] === 'membership_due') ? Number(rowYear[row.id] || currentYear) : undefined,
          receipt_number: rowReceipt[row.id] || undefined
        })
      });
      const data = await resp.json();
      if (!data.success && data.code !== 'EXISTS') throw new Error(data.message || 'Failed');
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Failed to create transaction');
    } finally {
      setBusyIds(b => ({ ...b, [row.id]: false }));
    }
  };

  const ignoreRow = async (row: SquareRow) => {
    setBusyIds(b => ({ ...b, [row.id]: true }));
    try {
      const headers = await authHeader();
      await fetch(`${process.env.REACT_APP_API_URL}/api/square/queue/${row.id}/ignore`, { method: 'POST', headers });
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Failed to ignore');
    } finally {
      setBusyIds(b => ({ ...b, [row.id]: false }));
    }
  };

  const pending = rows.filter(r => r.status === 'NEEDS_REVIEW' || r.status === 'AUTO_MATCHED');

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{t('square.title')}</h2>
        <label className="text-sm">{t('square.from')}
          <input type="date" className="ml-1 border rounded px-2 py-1" value={beginTime.slice(0,10)}
            onChange={e => setBeginTime(e.target.value ? `${e.target.value}T00:00:00Z` : '')} />
        </label>
        <label className="text-sm">{t('square.to')}
          <input type="date" className="ml-1 border rounded px-2 py-1" value={endTime.slice(0,10)}
            onChange={e => setEndTime(e.target.value ? `${e.target.value}T23:59:59Z` : '')} />
        </label>
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={runSync} disabled={loading}>
          {t('square.sync')}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && pending.length === 0 && <div className="text-gray-500">{t('square.noneToReview')}</div>}

      <div className="space-y-3">
        {pending.map(row => (
          <div key={row.id} className="border rounded p-3 space-y-2">
            <div className="flex justify-between flex-wrap gap-2 text-sm">
              <span><strong>{t('square.amount')}:</strong> ${Number(row.amount || 0).toFixed(2)}</span>
              <span><strong>{t('square.buyer')}:</strong> {row.buyer_name || row.buyer_email || '—'}</span>
              <span><strong>{t('square.status')}:</strong> {row.status}</span>
            </div>
            {row.note && <div className="text-xs text-gray-600">{t('square.note')}: {row.note}</div>}

            <div className="flex flex-wrap gap-2 items-center">
              <input className="border rounded px-2 py-1 text-sm" placeholder={t('square.searchMember')}
                value={rowSearch[row.id]?.query || ''}
                onChange={e => searchMember(row.id, e.target.value)} />
              {rowSearch[row.id]?.results?.length ? (
                <select className="border rounded px-2 py-1 text-sm"
                  value={rowSearch[row.id]?.selectedId || ''}
                  onChange={e => setRowSearch(s => ({ ...s, [row.id]: { ...(s[row.id]!), selectedId: Number(e.target.value) } }))}>
                  <option value="">—</option>
                  {rowSearch[row.id]!.results.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : null}

              <select className="border rounded px-2 py-1 text-sm" value={rowType[row.id] || 'donation'}
                onChange={e => setRowType(s => ({ ...s, [row.id]: e.target.value }))}>
                {PAYMENT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
              {rowType[row.id] === 'membership_due' && (
                <input className="border rounded px-2 py-1 text-sm w-20" type="number" placeholder={t('square.year')}
                  value={rowYear[row.id] || String(currentYear)}
                  onChange={e => setRowYear(s => ({ ...s, [row.id]: e.target.value }))} />
              )}
              <input className="border rounded px-2 py-1 text-sm w-24" placeholder={t('square.receipt')}
                value={rowReceipt[row.id] || ''}
                onChange={e => setRowReceipt(s => ({ ...s, [row.id]: e.target.value }))} />

              <button className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                disabled={busyIds[row.id]} onClick={() => confirmRow(row)}>{t('square.confirm')}</button>
              <button className="px-3 py-1 rounded bg-gray-300 disabled:opacity-50"
                disabled={busyIds[row.id]} onClick={() => ignoreRow(row)}>{t('square.ignore')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SquareReview;
```

- [ ] **Step 6: Run test to verify it passes**

Run (from `frontend/`): `CI=true npx react-scripts test src/components/admin/__tests__/SquareReview.test.tsx --watchAll=false`
Expected: PASS.

- [ ] **Step 7: Mount the page in the treasurer dashboard**

Open `frontend/src/components/admin/TreasurerDashboard.tsx`, find where `ZelleReview` is rendered/tabbed, and add a sibling "Square" tab/section that renders `<SquareReview />`. Follow the exact tab pattern already there (copy the Zelle tab entry and rename). Verify the app compiles: from `frontend/`, `npm run build:ci`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/SquareReview.tsx frontend/src/components/admin/__tests__/SquareReview.test.tsx frontend/src/i18n/dictionaries.ts frontend/src/components/admin/TreasurerDashboard.tsx
git commit -m "feat(square): add treasurer reconciliation page and i18n"
```

---

## Task 7: Manual verification against Square Sandbox

**Files:** none (operational).

- [ ] **Step 1: Configure sandbox env**

Set in `backend/.env`: `SQUARE_ENV=sandbox`, `SQUARE_ACCESS_TOKEN=<sandbox token>`, `SQUARE_WEBHOOK_SIGNATURE_KEY=<subscription key>`, `SQUARE_WEBHOOK_URL=<your tunneled URL>/api/square/webhook`. In the Square Developer dashboard, create a webhook subscription for `payment.created` + `payment.updated` pointing at that URL.

- [ ] **Step 2: Run the migration locally**

Run (from `backend/`): `npm run db:migrate:square` (against your local/dev DB; do **not** run against production `DATABASE_URL` without explicit approval).

- [ ] **Step 3: Trigger a sandbox payment and verify ingest**

Create a test payment in the Square sandbox (or use the dashboard's "Send test event" for `payment.created`). Confirm a `square_payments` row appears with `status='NEEDS_REVIEW'` and the correct amount.

- [ ] **Step 4: Reconcile via the UI**

In the treasurer dashboard Square tab, match the payment to a test member, pick a payment type, confirm, and verify a `Transaction` (`payment_method='credit_card'`, `external_id='square:<id>'`) + `LedgerEntry` were created and the row flipped to `CREATED`.

- [ ] **Step 5: Verify backfill idempotency**

Click "Sync from Square" for a range covering the test payment; confirm `stats.created` is `0` (already ingested) and no duplicate transaction is created.

---

## Self-Review

**Spec coverage:**
- Webhook ingest (signature-verified, raw body) → Task 4 (+ Task 2 verify).
- `square_payments` table/fields → Task 1.
- Idempotent upsert by `square_payment_id` → Task 3 (`upsertSquarePayment`) + Task 1 unique index.
- Learned/fuzzy + email matching → Task 3 (`matchSquareBuyer`).
- Confirm → Transaction (`credit_card`, `external_id='square:…'`) + LedgerEntry + learn → Task 3 (`createSquareTransaction`).
- Backfill via ListPayments → Task 2 (`listSquarePayments`) + Task 4 (`syncFromSquare`).
- Reconciliation UI (search/confirm/ignore/sync) → Task 6.
- Refunds acknowledged, no action → Task 4 (`handleWebhook` else-branch) + test.
- Auth (treasurer/admin) → Task 4 routes.
- Env prerequisites → Task 5; sandbox verification → Task 7.
- i18n en+ti → Task 6.

**Placeholder scan:** No "TBD/TODO/handle edge cases" left. The two "confirm exact path" notes (member-search URL, Treasurer tab mount) are explicit read-first steps with a named source file, not deferred implementation — the surrounding code is complete.

**Type consistency:** `upsertSquarePayment` returns `{ row, created }` (used in Task 4 `syncFromSquare` and tests). `createSquareTransaction` returns `{ success, id, code? }` (used in `processReview`, controller, tests). `matchSquareBuyer` returns `{ member_id, member_name, confidence, source }` (used in `upsertSquarePayment`). `external_id` is `square:<square_payment_id>` in the service, tests, and ledger memo. Status strings (`NEEDS_REVIEW`/`AUTO_MATCHED`/`CREATED`/`IGNORED`) are consistent across model, service, controller, and UI filter.
