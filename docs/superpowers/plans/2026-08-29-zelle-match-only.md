# Zelle Match-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Gmail Zelle path from creating transactions, turn it into a payer→member matching screen, and require treasurer approval for every Zelle bank row.

**Architecture:** Bank reconciliation becomes the only path that creates money. The Gmail screen writes learned payer→member associations into `bank_memo_matches` (via the existing `learnZelleAssociation`, whose pseudo-description is already key-compatible with real Chase CSV rows), so that when the CSV arrives the suggestion is already correct. Gmail creation sits behind an env flag, default off. In `autoReconcileCredit`, Zelle credits run Tier 0 only (exact reference match, which drains the existing Gmail-created backlog) and otherwise stay PENDING.

**Tech Stack:** Node 20 / Express / Sequelize / PostgreSQL (sqlite in-memory for tests), Jest + supertest, React 18 + TypeScript (CRA), React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-zelle-match-only-design.md`

## Global Constraints

- **Commit freely to this feature branch; never push, and never touch `main`.** Work happens in the `zelle-match-only` worktree branch, so each task's commit step runs as written without pausing for approval. What the repo owner's standing rule actually protects is the deploy: pushing `main` triggers GitHub Actions → OCI → pm2 *and* runs `npx sequelize-cli db:migrate` against the live Supabase database. So: no `git push`, no merge to `main`, no running migrations against any URL containing `supabase.com`. The merge decision belongs to the user at the end.
- The pre-commit hook runs the full backend and frontend suites plus a staged-PII check on every commit (~1-2 min). Leave it enabled — do not use `--no-verify`. If it blocks a commit, the tests genuinely fail or a file genuinely looks like member data; fix the cause.
- **Never put real member data in tests, fixtures, docs or commits.** All names in this plan are synthetic (`SYNTHETIC PAYER`, `Test Member`). Do not substitute real ones.
- Backend tests run against `DATABASE_URL=sqlite::memory:` (set by `backend/tests/setup.js`). Never point tests at the production Supabase URL.
- Migrations go in `backend/migrations/` (sequelize-cli, timestamp-prefixed, auto-run on deploy). Do **not** use `backend/src/database/migrations/`, which holds legacy ad-hoc scripts. See the `db-migrations` skill.
- Every migration needs a working `down()`.
- Match surrounding code style. There is no repo-wide ESLint/Prettier config; the frontend uses CRA's built-in `react-app` config.
- Run backend tests with `cd backend && npx jest <path>`. Run frontend tests with `cd frontend && CI=true npx react-scripts test --testPathPattern=<pattern>`.

---

### Task 1: Queue schema for human matches

Adds the audit columns a human match needs. `status` is already `STRING(20)`, so the new `MATCHED` value needs no schema change — only the doc comment.

**Files:**
- Create: `backend/migrations/20260829120000-add-match-audit-to-zelle-email-queue.js`
- Modify: `backend/src/models/ZelleEmailQueue.js`
- Test: `backend/tests/unit/zelleEmailQueueModel.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `ZelleEmailQueue.matched_by` (BIGINT, nullable), `ZelleEmailQueue.matched_at` (DATE, nullable), and the documented status value `'MATCHED'`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/zelleEmailQueueModel.test.js`:

```js
const { ZelleEmailQueue, Member } = require('../../src/models');

describe('ZelleEmailQueue match audit columns', () => {
    let member;

    beforeAll(async () => {
        member = await Member.create({
            first_name: 'Test',
            last_name: 'Member',
            phone_number: '+15550009999',
            is_active: true
        });
    });

    test('persists matched_by, matched_at and a MATCHED status', async () => {
        const matchedAt = new Date('2026-08-29T12:00:00Z');
        const row = await ZelleEmailQueue.create({
            external_id: 'zelle:SCHEMATEST1',
            payer_name: 'SYNTHETIC PAYER',
            amount: 25.00,
            payment_date: '2026-08-29',
            status: 'MATCHED',
            matched_member_id: member.id,
            matched_by: member.id,
            matched_at: matchedAt
        });

        await row.reload();
        expect(row.status).toBe('MATCHED');
        expect(String(row.matched_by)).toBe(String(member.id));
        expect(new Date(row.matched_at).toISOString()).toBe(matchedAt.toISOString());
    });

    test('leaves the audit columns null when a row is only queued', async () => {
        const row = await ZelleEmailQueue.create({
            external_id: 'zelle:SCHEMATEST2',
            status: 'NEEDS_REVIEW'
        });
        expect(row.matched_by).toBeNull();
        expect(row.matched_at).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/zelleEmailQueueModel.test.js`
Expected: FAIL — `matched_by` and `matched_at` are not model attributes, so they are silently dropped and `row.matched_by` is `undefined`, not `null`.

- [ ] **Step 3: Add the columns to the model**

In `backend/src/models/ZelleEmailQueue.js`, add after the existing `processed_at` attribute (keeping the trailing brace of the attributes object intact):

```js
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    matched_by: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    matched_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
```

In the same file, extend the class doc comment's status list:

```js
   *  - MATCHED      : treasurer associated this payer with a member; NO transaction
   *                   was created (bank reconciliation is the only path that posts money)
```

- [ ] **Step 4: Write the migration**

Create `backend/migrations/20260829120000-add-match-audit-to-zelle-email-queue.js`:

```js
'use strict';

// Records who matched a Zelle email to a member, and when. The Gmail path no
// longer creates transactions — it only teaches payer->member associations
// that bank reconciliation later consumes — so the human decision needs its
// own audit trail, separate from processed_at (which the sync sets).

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('zelle_email_queue');

    if (!table.matched_by) {
      await queryInterface.addColumn('zelle_email_queue', 'matched_by', {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Member id of the treasurer/admin who made the match'
      });
    }

    if (!table.matched_at) {
      await queryInterface.addColumn('zelle_email_queue', 'matched_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('zelle_email_queue');
    if (table.matched_at) await queryInterface.removeColumn('zelle_email_queue', 'matched_at');
    if (table.matched_by) await queryInterface.removeColumn('zelle_email_queue', 'matched_by');
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/zelleEmailQueueModel.test.js`
Expected: PASS (2 tests). Tests use `sequelize.sync()`, not migrations, so this proves the model; the migration is verified in Step 6.

- [ ] **Step 6: Verify the migration applies and reverses locally**

Run against your local dev database (never the Supabase URL):

```bash
cd backend
DATABASE_URL="postgres://localhost:5432/abune_aregawi_db" npx sequelize-cli db:migrate
DATABASE_URL="postgres://localhost:5432/abune_aregawi_db" npx sequelize-cli db:migrate:undo
DATABASE_URL="postgres://localhost:5432/abune_aregawi_db" npx sequelize-cli db:migrate
```

Expected: migrate succeeds, undo removes both columns, migrate re-applies cleanly.

- [ ] **Step 7: Prepare the commit, then ask before running it**

```bash
git add backend/migrations/20260829120000-add-match-audit-to-zelle-email-queue.js \
        backend/src/models/ZelleEmailQueue.js \
        backend/tests/unit/zelleEmailQueueModel.test.js
git commit -m "feat(zelle): add match audit columns to zelle_email_queue"
```

---

### Task 2: Feature flag module

**Files:**
- Create: `backend/src/config/featureFlags.js`
- Modify: `backend/env.example`
- Test: `backend/tests/unit/featureFlags.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `isZelleGmailCreateEnabled(): boolean` — reads `process.env` at call time (not module load) so tests and the running process can flip it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/featureFlags.test.js`:

```js
const { isZelleGmailCreateEnabled } = require('../../src/config/featureFlags');

describe('featureFlags.isZelleGmailCreateEnabled', () => {
    const original = process.env.ZELLE_GMAIL_CREATE_ENABLED;

    afterEach(() => {
        if (original === undefined) delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        else process.env.ZELLE_GMAIL_CREATE_ENABLED = original;
    });

    test('defaults to false when unset', () => {
        delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        expect(isZelleGmailCreateEnabled()).toBe(false);
    });

    test('is false for "false", empty string and arbitrary values', () => {
        for (const value of ['false', '', 'no', '1', 'yes']) {
            process.env.ZELLE_GMAIL_CREATE_ENABLED = value;
            expect(isZelleGmailCreateEnabled()).toBe(false);
        }
    });

    test('is true only for "true", case-insensitively', () => {
        for (const value of ['true', 'TRUE', 'True']) {
            process.env.ZELLE_GMAIL_CREATE_ENABLED = value;
            expect(isZelleGmailCreateEnabled()).toBe(true);
        }
    });

    test('is read at call time, not module load time', () => {
        delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        expect(isZelleGmailCreateEnabled()).toBe(false);
        process.env.ZELLE_GMAIL_CREATE_ENABLED = 'true';
        expect(isZelleGmailCreateEnabled()).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/featureFlags.test.js`
Expected: FAIL — `Cannot find module '../../src/config/featureFlags'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/config/featureFlags.js`:

```js
/**
 * Runtime feature flags, read from the environment at call time so they can
 * be flipped without a code change (and toggled inside tests).
 */

/**
 * When false (the default), the Gmail Zelle path never creates transactions.
 * It only records emails in zelle_email_queue and learns payer->member
 * associations; bank reconciliation is the sole path that posts money.
 */
function isZelleGmailCreateEnabled() {
  return String(process.env.ZELLE_GMAIL_CREATE_ENABLED || '').toLowerCase() === 'true';
}

module.exports = { isZelleGmailCreateEnabled };
```

- [ ] **Step 4: Document the flag**

In `backend/env.example`, add directly below the existing `ZELLE_SYNC_ENABLED=false` line:

```
# When false (default), the Gmail Zelle sync records emails and learns
# payer->member matches but never creates transactions. Bank reconciliation
# is the only path that posts money. Set to true to restore the old behavior.
ZELLE_GMAIL_CREATE_ENABLED=false
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/featureFlags.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Prepare the commit, then ask before running it**

```bash
git add backend/src/config/featureFlags.js backend/env.example backend/tests/unit/featureFlags.test.js
git commit -m "feat(zelle): add ZELLE_GMAIL_CREATE_ENABLED feature flag"
```

---

### Task 3: Gate Gmail auto-create behind the flag

**Files:**
- Modify: `backend/src/services/gmailZelleIngest.js:240-241` (the `canAutoCreate` branch)
- Test: `backend/tests/integration/zelleMatchOnly.test.js` (create)

**Interfaces:**
- Consumes: `isZelleGmailCreateEnabled()` from Task 2
- Produces: `syncZelleFromGmail` returns stats where `autoCreated` is always `0` while the flag is off, and every parsed email lands in `zelle_email_queue` with status `NEEDS_REVIEW`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/zelleMatchOnly.test.js`. The `googleapis` mock must be declared before the service is required, so keep `jest.mock` at the top of the file:

```js
// Chase Zelle notification fixture. Synthetic payer — never use real member data.
const MOCK_MESSAGE = {
    id: 'msg-1',
    internalDate: String(Date.parse('2026-08-20T15:00:00Z')),
    snippet: 'SYNTHETIC PAYER sent you $75.00',
    payload: {
        headers: [
            { name: 'Subject', value: 'You received money with Zelle' },
            { name: 'From', value: 'Chase <no.reply.alerts@chase.com>' },
            { name: 'Date', value: 'Thu, 20 Aug 2026 15:00:00 +0000' },
            { name: 'Message-Id', value: '<abc123@chase.com>' }
        ],
        parts: [{
            mimeType: 'text/plain',
            body: {
                data: Buffer.from(
                    'SYNTHETIC PAYER sent you $75.00 Transaction number: TESTREF123456 Memo N/A'
                ).toString('base64')
            }
        }]
    }
};

jest.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: class { setCredentials() {} } },
        gmail: () => ({
            users: {
                labels: {
                    list: async () => ({ data: { labels: [] } }),
                    create: async () => ({ data: { id: 'label-1' } })
                },
                messages: {
                    list: async () => ({ data: { messages: [{ id: 'msg-1' }] } }),
                    get: async () => ({ data: MOCK_MESSAGE }),
                    modify: async () => ({})
                }
            }
        })
    }
}));

const {
    Member, Transaction, LedgerEntry, ZelleEmailQueue, ZelleMemoMatch, BankMemoMatch, IncomeCategory
} = require('../../src/models');
const { syncZelleFromGmail } = require('../../src/services/gmailZelleIngest');
const { learnBankMemoMatch } = require('../../src/services/bankMemoMatchService');

describe('Zelle match-only mode', () => {
    let member;

    beforeAll(async () => {
        process.env.GMAIL_CLIENT_ID = 'test-client-id';
        process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
        process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';

        await Member.destroy({ where: {} });
        member = await Member.create({
            first_name: 'Synthetic',
            last_name: 'Payer',
            phone_number: '+15550003333',
            role: 'admin',
            is_active: true
        });
        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' }
        });
    });

    beforeEach(async () => {
        delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        await ZelleEmailQueue.destroy({ where: {} });
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
    });

    test('creates no transaction and queues the email for review when the flag is off', async () => {
        // A learned association that WOULD have triggered auto-create before
        await learnBankMemoMatch({
            type: 'ZELLE',
            payer_name: 'SYNTHETIC PAYER',
            description: 'Zelle payment from SYNTHETIC PAYER 0000000'
        }, member.id);

        const stats = await syncZelleFromGmail({ dryRun: false });

        expect(stats.autoCreated).toBe(0);
        expect(stats.needsReview).toBe(1);
        expect(await Transaction.count()).toBe(0);
        expect(await LedgerEntry.count()).toBe(0);

        const row = await ZelleEmailQueue.findOne({ where: { external_id: 'zelle:TESTREF123456' } });
        expect(row).not.toBeNull();
        expect(row.status).toBe('NEEDS_REVIEW');
        expect(row.payer_name).toBe('SYNTHETIC PAYER');
        expect(Number(row.amount)).toBe(75);
        // The suggestion is still recorded, so the UI can pre-select it
        expect(String(row.matched_member_id)).toBe(String(member.id));
        expect(row.match_confidence).toBe('high');
    });

    test('still auto-creates when the flag is explicitly enabled', async () => {
        process.env.ZELLE_GMAIL_CREATE_ENABLED = 'true';
        await learnBankMemoMatch({
            type: 'ZELLE',
            payer_name: 'SYNTHETIC PAYER',
            description: 'Zelle payment from SYNTHETIC PAYER 0000000'
        }, member.id);

        const stats = await syncZelleFromGmail({ dryRun: false });

        expect(stats.autoCreated).toBe(1);
        expect(await Transaction.count()).toBe(1);
        const row = await ZelleEmailQueue.findOne({ where: { external_id: 'zelle:TESTREF123456' } });
        expect(row.status).toBe('AUTO_CREATED');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js`
Expected: the first test FAILS (`stats.autoCreated` is `1`, a Transaction exists, status is `AUTO_CREATED`); the second test passes already.

- [ ] **Step 3: Gate the auto-create branch**

In `backend/src/services/gmailZelleIngest.js`, add to the imports near the top:

```js
const { isZelleGmailCreateEnabled } = require('../config/featureFlags');
```

Then change the `canAutoCreate` line (currently line 240) from:

```js
      const canAutoCreate = match.confidence === 'high' && match.member_id && parsed.amount;
```

to:

```js
      // Match-only mode: the Gmail path records the email and its suggested
      // member but never posts money — bank reconciliation is the only path
      // that creates transactions. See ZELLE_GMAIL_CREATE_ENABLED.
      const canAutoCreate = isZelleGmailCreateEnabled()
        && match.confidence === 'high'
        && match.member_id
        && parsed.amount;
```

No other change is needed: the existing `else` branch already writes the `NEEDS_REVIEW` queue row carrying `matched_member_id`, `match_confidence` and `match_source`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the surrounding suites for regressions**

Run: `cd backend && npx jest tests/unit/zelleTransactionService.test.js tests/integration/zelleBatch.test.js tests/integration/autoReconcile.test.js`
Expected: PASS. `zelleBatch` exercises the create endpoints directly rather than the sync, so it should be unaffected here — Task 4 changes it.

- [ ] **Step 6: Prepare the commit, then ask before running it**

```bash
git add backend/src/services/gmailZelleIngest.js backend/tests/integration/zelleMatchOnly.test.js
git commit -m "feat(zelle): gate Gmail auto-create behind ZELLE_GMAIL_CREATE_ENABLED"
```

---

### Task 4: Block the create endpoints while the flag is off

**Files:**
- Modify: `backend/src/controllers/zelleController.js` (`createTransactionFromPreview`, `createBatchTransactions`)
- Test: `backend/tests/integration/zelleBatch.test.js` (add cases), `backend/tests/integration/zelleMatchOnly.test.js` (add cases)

**Interfaces:**
- Consumes: `isZelleGmailCreateEnabled()` from Task 2
- Produces: `POST /api/zelle/reconcile/create-transaction` and `POST /api/zelle/reconcile/batch-create` return `403 { success: false, code: 'CREATE_DISABLED' }` while the flag is off.

- [ ] **Step 1: Write the failing test**

Append to the `describe('Zelle match-only mode', ...)` block in `backend/tests/integration/zelleMatchOnly.test.js`. Add these requires at the top of the file, below the existing ones:

```js
const request = require('supertest');
const app = require('../../src/server');
```

Then add inside the describe block:

```js
    describe('create endpoints while the flag is off', () => {
        test('POST /api/zelle/reconcile/create-transaction returns 403', async () => {
            const res = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    external_id: 'zelle:BLOCKED1',
                    amount: 40.00,
                    payment_date: '2026-08-20',
                    member_id: member.id,
                    payment_type: 'donation'
                })
                .expect(403);

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CREATE_DISABLED');
            expect(await Transaction.count()).toBe(0);
        });

        test('POST /api/zelle/reconcile/batch-create returns 403', async () => {
            const res = await request(app)
                .post('/api/zelle/reconcile/batch-create')
                .set('Authorization', 'Bearer valid-token')
                .send({ items: [{
                    external_id: 'zelle:BLOCKED2',
                    amount: 40.00,
                    payment_date: '2026-08-20',
                    member_id: member.id,
                    payment_type: 'donation'
                }] })
                .expect(403);

            expect(res.body.code).toBe('CREATE_DISABLED');
            expect(await Transaction.count()).toBe(0);
        });
    });
```

The `beforeAll` in this file creates `member` with `role: 'admin'`, but the auth middleware resolves the caller by the mocked Firebase identity in `tests/setup.js` (`test@example.com` / `test-firebase-uid`). Update the existing `beforeAll` member creation to carry those so the request authenticates:

```js
        member = await Member.create({
            first_name: 'Synthetic',
            last_name: 'Payer',
            email: 'test@example.com',
            firebase_uid: 'test-firebase-uid',
            phone_number: '+15550003333',
            role: 'admin',
            is_active: true
        });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js`
Expected: the two new tests FAIL with 200 instead of 403.

- [ ] **Step 3: Add the guard**

In `backend/src/controllers/zelleController.js`, add to the imports:

```js
const { isZelleGmailCreateEnabled } = require('../config/featureFlags');
```

Add this helper above `createTransactionFromPreview`:

```js
// Match-only mode: transaction creation from the Gmail screen is disabled;
// bank reconciliation is the only path that posts money.
function creationDisabledResponse(res) {
  return res.status(403).json({
    success: false,
    code: 'CREATE_DISABLED',
    message: 'Creating transactions from Zelle emails is disabled. Match the payer to a member here, then approve the payment in Bank Reconciliation.'
  });
}
```

Add the guard as the first line inside both handlers:

```js
async function createTransactionFromPreview(req, res) {
  if (!isZelleGmailCreateEnabled()) return creationDisabledResponse(res);
  try {
```

```js
async function createBatchTransactions(req, res) {
  if (!isZelleGmailCreateEnabled()) return creationDisabledResponse(res);
  try {
```

- [ ] **Step 4: Guard the existing batch suite**

`backend/tests/integration/zelleBatch.test.js` exercises these endpoints and will now 403. Set the flag for that suite by adding to its top-level `describe`, before the existing `beforeAll`:

```js
    const originalFlag = process.env.ZELLE_GMAIL_CREATE_ENABLED;
    beforeAll(() => { process.env.ZELLE_GMAIL_CREATE_ENABLED = 'true'; });
    afterAll(() => {
        if (originalFlag === undefined) delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        else process.env.ZELLE_GMAIL_CREATE_ENABLED = originalFlag;
    });
```

This keeps that suite meaningful: it now documents flag-on behavior, which is exactly what it was written to cover.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js tests/integration/zelleBatch.test.js`
Expected: PASS, all tests in both files.

- [ ] **Step 6: Prepare the commit, then ask before running it**

```bash
git add backend/src/controllers/zelleController.js \
        backend/tests/integration/zelleMatchOnly.test.js \
        backend/tests/integration/zelleBatch.test.js
git commit -m "feat(zelle): return 403 from create endpoints in match-only mode"
```

---

### Task 5: The match endpoint

The core of the feature: a treasurer assigns a member to a queued email, which writes the learned keys that bank reconciliation will later find.

**Files:**
- Modify: `backend/src/services/zelleTransactionService.js` (add `matchQueueRowToMember`, export it)
- Modify: `backend/src/controllers/zelleController.js` (add `matchQueueItem`, export it)
- Modify: `backend/src/routes/zelleRoutes.js` (mount the route)
- Test: `backend/tests/integration/zelleMatchOnly.test.js` (add cases)

**Interfaces:**
- Consumes: `learnZelleAssociation({ payerName, note, memberId })` (already exported from `zelleTransactionService`)
- Produces:
  - `matchQueueRowToMember({ queueId, memberId, payerName = null, userId = null })` → `{ success: true, data: <ZelleEmailQueue row> }` or `{ success: false, code: 'NOT_FOUND' | 'ALREADY_POSTED' | 'MEMBER_NOT_FOUND', message }`
  - `POST /api/zelle/queue/:id/match` body `{ member_id, payer_name? }` → 200 with the updated row, 404 `NOT_FOUND`, 409 `ALREADY_POSTED`, 400 `MEMBER_NOT_FOUND`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/integration/zelleMatchOnly.test.js`. Add `findSuggestionCandidates` to the `bankMemoMatchService` require at the top of the file:

```js
const { learnBankMemoMatch, findSuggestionCandidates } = require('../../src/services/bankMemoMatchService');
```

Then add this describe block:

```js
    describe('POST /api/zelle/queue/:id/match', () => {
        let queueRow;

        beforeEach(async () => {
            queueRow = await ZelleEmailQueue.create({
                external_id: 'zelle:MATCHME1',
                payer_name: 'SYNTHETIC PAYER',
                amount: 75.00,
                payment_date: '2026-08-20',
                note: 'SYNTHETIC PAYER sent you $75.00',
                status: 'NEEDS_REVIEW'
            });
        });

        test('learns keys a real bank CSV row will hit — the crux of the design', async () => {
            await request(app)
                .post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(200);

            // A real Chase CSV Zelle row, as bankParserService would produce it
            const bankRow = {
                type: 'ZELLE',
                payer_name: 'SYNTHETIC PAYER',
                description: 'Zelle payment from SYNTHETIC PAYER 27250625041'
            };
            const suggestions = await findSuggestionCandidates(bankRow);
            const learned = suggestions.find(s => String(s.source || '').startsWith('LEARNED'));

            expect(learned).toBeDefined();
            expect(learned.confidence).toBe('high');
            expect(String(learned.member.id)).toBe(String(member.id));
        });

        test('stamps the queue row and creates no transaction', async () => {
            const res = await request(app)
                .post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(200);

            expect(res.body.success).toBe(true);
            await queueRow.reload();
            expect(queueRow.status).toBe('MATCHED');
            expect(String(queueRow.matched_member_id)).toBe(String(member.id));
            expect(String(queueRow.matched_by)).toBe(String(member.id));
            expect(queueRow.matched_at).not.toBeNull();
            expect(await Transaction.count()).toBe(0);
        });

        test('is idempotent and re-matching moves the learned key to the new member', async () => {
            const other = await Member.create({
                first_name: 'Other', last_name: 'Member',
                phone_number: '+15550004444', is_active: true
            });

            await request(app).post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id }).expect(200);
            await request(app).post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: other.id }).expect(200);

            const suggestions = await findSuggestionCandidates({
                type: 'ZELLE',
                payer_name: 'SYNTHETIC PAYER',
                description: 'Zelle payment from SYNTHETIC PAYER 27250625041'
            });
            const learned = suggestions.filter(s => String(s.source || '').startsWith('LEARNED'));
            expect(learned).toHaveLength(1);
            expect(String(learned[0].member.id)).toBe(String(other.id));
        });

        test('accepts a payer_name override when the email could not be parsed', async () => {
            const unparsed = await ZelleEmailQueue.create({
                external_id: 'zelle:NOPAYER1',
                payer_name: null,
                amount: 60.00,
                payment_date: '2026-08-21',
                note: 'You received money with Zelle',
                status: 'NEEDS_REVIEW'
            });

            await request(app)
                .post(`/api/zelle/queue/${unparsed.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id, payer_name: 'OVERRIDE PAYER' })
                .expect(200);

            await unparsed.reload();
            expect(unparsed.payer_name).toBe('OVERRIDE PAYER');

            const suggestions = await findSuggestionCandidates({
                type: 'ZELLE',
                payer_name: 'OVERRIDE PAYER',
                description: 'Zelle payment from OVERRIDE PAYER 99887766'
            });
            expect(suggestions.some(s => String(s.source || '').startsWith('LEARNED'))).toBe(true);
        });

        test('refuses to re-match a row that already posted a transaction', async () => {
            // A real Transaction, not a literal id: ZelleEmailQueue.belongsTo(Transaction)
            // yields a foreign key under sequelize.sync(), and the sqlite dialect enforces
            // it — a dangling id would throw on insert instead of reaching the 409 path.
            const postedTxn = await Transaction.create({
                member_id: member.id,
                collected_by: member.id,
                payment_date: '2026-08-20',
                amount: 75.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'zelle:POSTEDTXN1'
            });
            const posted = await ZelleEmailQueue.create({
                external_id: 'zelle:POSTED1',
                payer_name: 'SYNTHETIC PAYER',
                status: 'AUTO_CREATED',
                transaction_id: postedTxn.id
            });

            const res = await request(app)
                .post(`/api/zelle/queue/${posted.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(409);

            expect(res.body.code).toBe('ALREADY_POSTED');
        });

        test('404s for an unknown queue row and 400s for an unknown member', async () => {
            await request(app)
                .post('/api/zelle/queue/00000000-0000-0000-0000-000000000000/match')
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(404);

            await request(app)
                .post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: 987654321 })
                .expect(400);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js -t "queue"`
Expected: FAIL with 404s — the route does not exist.

- [ ] **Step 3: Implement the service function**

In `backend/src/services/zelleTransactionService.js`, add before `module.exports`. No new imports are needed — `Member` and `ZelleEmailQueue` are already destructured from `../models` at the top of the file, and `learnZelleAssociation` is defined above in the same module.

```js
/**
 * Associate a queued Zelle email with a member WITHOUT creating a transaction.
 *
 * This is the whole point of match-only mode: it writes the learned payer keys
 * (bank_memo_matches + the legacy memo row) that bank reconciliation will find
 * when the corresponding Chase CSV row is uploaded, so the treasurer approves a
 * pre-filled suggestion instead of identifying the giver from scratch.
 *
 * Re-runnable: matching again updates the learned keys, which is how a
 * treasurer corrects a mistake.
 */
async function matchQueueRowToMember({ queueId, memberId, payerName = null, userId = null }) {
  const row = await ZelleEmailQueue.findByPk(queueId);
  if (!row) {
    return { success: false, code: 'NOT_FOUND', message: 'Queue item not found' };
  }
  if (row.transaction_id) {
    return {
      success: false,
      code: 'ALREADY_POSTED',
      message: 'This email already has a transaction; its member association is settled by that transaction.'
    };
  }

  const member = await Member.findByPk(memberId, { attributes: ['id'] });
  if (!member) {
    return { success: false, code: 'MEMBER_NOT_FOUND', message: 'Member not found' };
  }

  // An explicit override wins: when extractPayerName failed, the stored
  // payer_name is null and learning would key off memo text that no bank row
  // ever matches.
  const effectivePayerName = (payerName && String(payerName).trim()) || row.payer_name || null;

  await learnZelleAssociation({
    payerName: effectivePayerName,
    note: row.note,
    memberId: member.id
  });

  await row.update({
    payer_name: effectivePayerName,
    matched_member_id: member.id,
    match_confidence: 'high',
    match_source: 'TREASURER_MATCH',
    status: 'MATCHED',
    matched_by: userId || null,
    matched_at: new Date(),
    error: null
  });

  return { success: true, data: row };
}
```

Add `matchQueueRowToMember` to the `module.exports` object in that file.

- [ ] **Step 4: Implement the controller and route**

In `backend/src/controllers/zelleController.js`, add `matchQueueRowToMember` to the existing `require` of `../services/zelleTransactionService`, then add this handler above `module.exports`:

```js
// POST /api/zelle/queue/:id/match
// Body: { member_id, payer_name? }
// Associates a payer with a member for later bank reconciliation.
// Creates NO transaction.
async function matchQueueItem(req, res) {
  try {
    const { member_id, payer_name } = req.body || {};
    if (!member_id) {
      return res.status(400).json({ success: false, message: 'member_id is required' });
    }

    const result = await matchQueueRowToMember({
      queueId: req.params.id,
      memberId: member_id,
      payerName: payer_name,
      userId: req.user?.id || null
    });

    if (!result.success) {
      const statusByCode = { NOT_FOUND: 404, ALREADY_POSTED: 409, MEMBER_NOT_FOUND: 400 };
      return res.status(statusByCode[result.code] || 400).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error('Zelle queue match error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
```

Add `matchQueueItem` to the controller's `module.exports`.

In `backend/src/routes/zelleRoutes.js`, add below the existing queue routes:

```js
router.post('/queue/:id/match', require('../controllers/zelleController').matchQueueItem);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js`
Expected: PASS, all tests.

- [ ] **Step 6: Prepare the commit, then ask before running it**

```bash
git add backend/src/services/zelleTransactionService.js \
        backend/src/controllers/zelleController.js \
        backend/src/routes/zelleRoutes.js \
        backend/tests/integration/zelleMatchOnly.test.js
git commit -m "feat(zelle): add POST /api/zelle/queue/:id/match for payer-to-member matching"
```

---

### Task 6: Paginated, searchable queue listing

The queue becomes the primary screen, so it must page and filter rather than cap at 200 rows.

**Files:**
- Modify: `backend/src/controllers/zelleController.js` (`getQueue`)
- Test: `backend/tests/integration/zelleMatchOnly.test.js` (add cases)

**Interfaces:**
- Consumes: nothing new
- Produces: `GET /api/zelle/queue?status=&search=&page=&limit=` → `{ success, count, items, pagination: { total, page, pages } }`. `count` is retained for backward compatibility with the existing `AUTO_CREATED` sidebar fetch. Default ordering puts unmatched rows first, then newest payment date.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/integration/zelleMatchOnly.test.js`:

```js
    describe('GET /api/zelle/queue', () => {
        beforeEach(async () => {
            await ZelleEmailQueue.bulkCreate([
                { external_id: 'zelle:L1', payer_name: 'ALPHA PAYER', amount: 10, payment_date: '2026-08-01', status: 'MATCHED', matched_member_id: member.id },
                { external_id: 'zelle:L2', payer_name: 'BETA PAYER', amount: 20, payment_date: '2026-08-02', status: 'NEEDS_REVIEW' },
                { external_id: 'zelle:L3', payer_name: 'GAMMA PAYER', amount: 30, payment_date: '2026-08-03', status: 'NEEDS_REVIEW' }
            ]);
        });

        test('paginates and reports totals', async () => {
            const res = await request(app)
                .get('/api/zelle/queue?limit=2&page=1')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(res.body.items).toHaveLength(2);
            expect(res.body.pagination.total).toBe(3);
            expect(res.body.pagination.pages).toBe(2);
            expect(res.body.pagination.page).toBe(1);
        });

        test('orders unmatched rows first', async () => {
            const res = await request(app)
                .get('/api/zelle/queue')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(res.body.items[0].status).toBe('NEEDS_REVIEW');
            expect(res.body.items[res.body.items.length - 1].status).toBe('MATCHED');
        });

        test('filters by search across payer name', async () => {
            const res = await request(app)
                .get('/api/zelle/queue?search=BETA')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].payer_name).toBe('BETA PAYER');
        });

        test('still filters by status', async () => {
            const res = await request(app)
                .get('/api/zelle/queue?status=NEEDS_REVIEW')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(res.body.items).toHaveLength(2);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js -t "GET /api/zelle/queue"`
Expected: FAIL — no `pagination` in the response body, and no search support.

- [ ] **Step 3: Rewrite getQueue**

Replace the body of `getQueue` in `backend/src/controllers/zelleController.js`:

```js
// GET /api/zelle/queue?status=NEEDS_REVIEW&search=smith&page=1&limit=50
// The treasurer's primary Zelle screen: every email the sync has recorded,
// with its current member match.
async function getQueue(req, res) {
  try {
    const { Op } = require('sequelize');
    const { sequelize } = require('../models');

    const { status, search } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const where = {};
    if (status) where.status = String(status).toUpperCase();

    const term = String(search || '').trim();
    if (term) {
      const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
      const contains = { [likeOp]: `%${term}%` };
      where[Op.or] = [
        { payer_name: contains },
        { note: contains },
        { subject: contains }
      ];
    }

    const { count, rows } = await ZelleEmailQueue.findAndCountAll({
      where,
      // Unmatched work first, then most recent payments. `matched_member_id IS
      // NULL` sorts DESC in both dialects: Postgres puts TRUE first, sqlite
      // puts 1 first. A CASE expression would need dialect-specific quoting.
      order: [
        [sequelize.literal('matched_member_id IS NULL'), 'DESC'],
        ['payment_date', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
      include: [
        { model: Member, as: 'matchedMember', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction', attributes: ['id', 'amount', 'payment_type', 'payment_date', 'receipt_number'] }
      ]
    });

    return res.json({
      success: true,
      count: rows.length,
      items: rows,
      pagination: { total: count, page, pages: Math.ceil(count / limit) }
    });
  } catch (error) {
    console.error('Zelle queue list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/integration/zelleMatchOnly.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Prepare the commit, then ask before running it**

```bash
git add backend/src/controllers/zelleController.js backend/tests/integration/zelleMatchOnly.test.js
git commit -m "feat(zelle): paginate and filter the Zelle email queue listing"
```

---

### Task 7: Zelle credits require approval in bank reconciliation

**Files:**
- Modify: `backend/src/services/autoReconcileService.js` (`autoReconcileCredit`, after the Tier 0 block)
- Test: `backend/tests/integration/autoReconcile.test.js` (add a describe block, adjust Tier 1/2 Zelle cases)

**Interfaces:**
- Consumes: `sourceTypeFor` (already imported in that file)
- Produces: `autoReconcileCredit` returns `null` for Zelle rows that Tier 0 did not match, leaving them `PENDING`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/integration/autoReconcile.test.js`, inside the top-level describe:

```js
    describe('Zelle credits require approval', () => {
        test('does not auto-create for a learned Zelle payer; row stays PENDING', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-01'),
                amount: 90.00,
                description: 'Zelle payment from ALMAZ TESFAY 55443322',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                transaction_hash: 'bankhash-approve-1',
                raw_data: {}
            });
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoMember).toBe(0);
            expect(stats.needsReview).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            expect(await Transaction.count()).toBe(0);
        });

        test('does not auto-link a Zelle row to a heuristic Tier 1 candidate', async () => {
            const handEntered = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-03-05',
                amount: 120.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'manual:entry-1'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-06'),
                amount: 120.00,
                description: 'Zelle payment from ALMAZ TESFAY 66554433',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                transaction_hash: 'bankhash-approve-2',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoLinked).toBe(0);
            expect(stats.needsReview).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            await handEntered.reload();
            expect(handEntered.external_id).toBe('manual:entry-1'); // not renamed
        });

        test('Tier 0 still absorbs the Gmail-created backlog by exact reference', async () => {
            const backlog = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-03-10',
                amount: 45.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'zelle:BACKLOGREF1'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-14'),
                amount: 45.00,
                description: 'Zelle payment from ALMAZ TESFAY BACKLOGREF1',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'BACKLOGREF1',
                transaction_hash: 'bankhash-approve-3',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoLinked).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_meta.transaction_id).toBe(backlog.id);
            expect(await Transaction.count()).toBe(1);
        });

        test('ACH credits still auto-create for a learned payer', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-20'),
                amount: 65.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-approve-4',
                raw_data: {}
            });
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoMember).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_MEMBER');
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/integration/autoReconcile.test.js -t "Zelle credits require approval"`
Expected: the first two tests FAIL (`autoMember` is 1, `autoLinked` is 1); the Tier 0 and ACH tests pass already.

- [ ] **Step 3: Add the approval gate**

In `backend/src/services/autoReconcileService.js`, in `autoReconcileCredit`, insert this immediately after the Tier 0 `if (plain.external_ref_id) { ... }` block and before the Tier 1 comment:

```js
  // Zelle credits require explicit treasurer approval. Tier 0 above is an
  // exact reference match and is allowed to run because it only ever links a
  // transaction the Gmail automation already created (the legacy backlog) and
  // never posts money. Everything below is heuristic — a name/amount/date
  // guess (Tier 1) or a create (Tier 2) — so Zelle rows stop here and stay
  // PENDING with suggestions for the treasurer to approve.
  //
  // linkOnly callers are exempt: they run from
  // linkPendingBankRowsForTransaction, which only fires when a transaction was
  // just created deliberately, and which never creates anything itself.
  if (sourceTypeFor(plain) === 'ZELLE' && !linkOnly) {
    return null;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/integration/autoReconcile.test.js`
Expected: the four new tests PASS. Pre-existing Tier 1 and Tier 2 tests that use Zelle rows will now FAIL — that is correct, their behavior deliberately changed.

- [ ] **Step 5: Update the superseded Zelle tier tests**

For each pre-existing failing test in the `Tier 1` and `Tier 2` describe blocks that uses a `ZELLE_CREDIT` bank row, do one of two things — do not delete coverage:

- If the test's point is the *tier mechanism* (learned lookup, last-used payment type, ambiguity handling), convert its bank row to ACH by changing `type` to `'ACH_CREDIT'` and `description` to `'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234'`, leaving assertions intact. The mechanism is payment-method agnostic.
- If the test's point is specifically *Zelle* behavior, move it into the new "Zelle credits require approval" block and invert its expectation to PENDING.

Also update the module doc comment at the top of `autoReconcileService.js` so the tier description matches reality — add to the Tier 1 and Tier 2 paragraphs: `Zelle credits are excluded; they require treasurer approval.`

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS. Investigate every failure; do not skip tests to get green.

- [ ] **Step 7: Prepare the commit, then ask before running it**

```bash
git add backend/src/services/autoReconcileService.js backend/tests/integration/autoReconcile.test.js
git commit -m "feat(bank): require treasurer approval for Zelle credits"
```

---

### Task 8: Widen the Zelle duplicate-candidate window in the list endpoint

Tier 1 used a ±5 day window for Zelle because the email date and bank posting date differ over weekends. With Tier 1's action removed, the treasurer sees candidates through `potential_matches`, which is computed with the default ±2 — so a payment posting 3-5 days later would silently show nothing.

**Files:**
- Modify: `backend/src/controllers/bankTransactionController.js:274-277` (the `findPotentialMatches` call inside `getBankTransactions`)
- Test: `backend/tests/integration/reconciliation.test.js` (add a case)

**Interfaces:**
- Consumes: `findPotentialMatches(bankTxn, { dayWindow })` from `reconciliationService`
- Produces: no signature change; Zelle rows are enriched with candidates up to ±5 days.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/integration/reconciliation.test.js` inside its top-level describe. If the file lacks the imports below, add them at the top:

```js
    test('surfaces a Zelle duplicate candidate posted 4 days after the payment', async () => {
        const existing = await Transaction.create({
            member_id: member.id,
            collected_by: adminUser.id,
            payment_date: '2025-04-01',
            amount: 150.00,
            payment_type: 'donation',
            payment_method: 'zelle',
            status: 'succeeded',
            external_id: 'manual:window-1'
        });

        await BankTransaction.create({
            date: new Date('2025-04-05'), // 4 days later: outside ±2, inside ±5
            amount: 150.00,
            description: 'Zelle payment from ALMAZ TESFAY 77665544',
            type: 'ZELLE_CREDIT',
            status: 'PENDING',
            payer_name: 'ALMAZ TESFAY',
            transaction_hash: 'bankhash-window-1',
            raw_data: {}
        });

        const res = await request(app)
            .get('/api/bank/transactions?status=PENDING')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const row = res.body.data.transactions.find(t => t.transaction_hash === 'bankhash-window-1');
        expect(row.potential_matches).toBeDefined();
        expect(row.potential_matches.map(m => m.id)).toContain(existing.id);
    });
```

This test requires a `member` whose name tokens match `ALMAZ TESFAY`. Reuse the suite's existing member fixture; if it differs, adjust the `payer_name` and `description` to match that member's name rather than inventing a new one.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/integration/reconciliation.test.js -t "4 days"`
Expected: FAIL — `potential_matches` is undefined, because the default ±2 window excludes the candidate.

- [ ] **Step 3: Pass the wider window for Zelle**

In `backend/src/controllers/bankTransactionController.js`, inside `getBankTransactions`, replace:

```js
                const { findPotentialMatches } = require('../services/reconciliationService');
                const potentialMatches = await findPotentialMatches(plain);
```

with:

```js
                const { findPotentialMatches } = require('../services/reconciliationService');
                // Zelle needs a wider window than the ±2 day default: the email
                // arrives when the payment is sent, but the bank can post it
                // several days later over weekends and holidays. Zelle rows are
                // no longer auto-linked, so this list is the treasurer's only
                // view of a possible existing entry.
                const { sourceTypeFor } = require('../services/bankMemoMatchService');
                const dayWindow = sourceTypeFor(plain) === 'ZELLE' ? 5 : 2;
                const potentialMatches = await findPotentialMatches(plain, { dayWindow });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/integration/reconciliation.test.js`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Prepare the commit, then ask before running it**

```bash
git add backend/src/controllers/bankTransactionController.js backend/tests/integration/reconciliation.test.js
git commit -m "feat(bank): widen Zelle duplicate-candidate window to 5 days in list view"
```

---

### Task 9: Rewrite ZelleReview as a read-only matching table

**Files:**
- Modify: `frontend/src/components/admin/ZelleReview.tsx`
- Test: `frontend/src/components/admin/__tests__/ZelleReview.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /api/zelle/queue?search=&page=&limit=` and `POST /api/zelle/queue/:id/match` from Tasks 5-6
- Produces: no exported interface change; the component's default export stays.

The component currently reads `GET /api/zelle/preview/gmail` (a live Gmail round trip capped at 50 messages / 30 days) and posts to the two create endpoints. It moves to the persisted queue and the match endpoint.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/__tests__/ZelleReview.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ZelleReview from '../ZelleReview';

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        currentUser: { id: 1, role: 'treasurer' },
        firebaseUser: { getIdToken: () => Promise.resolve('mock-token') }
    }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

global.fetch = jest.fn();

const queueItem = {
    id: 'q-1',
    external_id: 'zelle:TESTREF123456',
    payer_name: 'SYNTHETIC PAYER',
    amount: '75.00',
    payment_date: '2026-08-20',
    note: 'SYNTHETIC PAYER sent you $75.00',
    status: 'NEEDS_REVIEW',
    transaction_id: null,
    matchedMember: null,
};

const mockQueue = (items: any[] = [queueItem]) => {
    (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
            success: true,
            items,
            pagination: { total: items.length, page: 1, pages: 1 },
        }),
    });
};

describe('ZelleReview (match-only)', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
    });

    test('renders the queue row with date, amount, payer and memo', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.getByText('2026-08-20')).toBeInTheDocument();
        expect(screen.getByText(/75\.00/)).toBeInTheDocument();
        expect(screen.getByText(/sent you/)).toBeInTheDocument();
    });

    test('reads from the queue endpoint, not the Gmail preview endpoint', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        const urls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
        expect(urls.some(u => u.includes('/api/zelle/queue'))).toBe(true);
        expect(urls.some(u => u.includes('/api/zelle/preview/gmail'))).toBe(false);
    });

    test('offers no transaction-creating controls', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.queryByRole('button', { name: /^create$/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument();
    });

    test('shows an existing match as text with no edit control when already posted', async () => {
        mockQueue([{
            ...queueItem,
            id: 'q-2',
            status: 'AUTO_CREATED',
            transaction_id: 42,
            matchedMember: { id: 7, first_name: 'Test', last_name: 'Member' },
        }]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('Test Member'));
        expect(screen.queryByRole('button', { name: /match/i })).not.toBeInTheDocument();
    });

    test('posts to the match endpoint when a member is saved', async () => {
        mockQueue();
        render(<ZelleReview />);
        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));

        fireEvent.change(screen.getByPlaceholderText(/member id/i), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: /match/i }));

        await waitFor(() => {
            const call = (global.fetch as jest.Mock).mock.calls
                .find(c => String(c[0]).includes('/queue/q-1/match'));
            expect(call).toBeDefined();
            expect(call[1].method).toBe('POST');
            expect(JSON.parse(call[1].body)).toMatchObject({ member_id: 7 });
        });
    });

    test('asks for a payer name when the email could not be parsed', async () => {
        mockQueue([{ ...queueItem, payer_name: null }]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByPlaceholderText(/payer name/i));
        expect(screen.getByPlaceholderText(/payer name/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern=ZelleReview`
Expected: FAIL — the component still fetches the preview endpoint and renders Create controls.

- [ ] **Step 3: Rewrite the component**

Replace `frontend/src/components/admin/ZelleReview.tsx` with a component that:

1. Keeps the `QueueItem` interface, extended with `matched_by?: number | null`, `matched_at?: string | null`, `match_source?: string | null`, `match_confidence?: string | null`, `subject?: string | null`.
2. Deletes the `ZellePreviewItem` interface, the preview fetch, `handleCreate`, `handleBatchCreate`, receipt-number state, selection-checkbox state, and the manual-donor state — every code path that posted to `reconcile/create-transaction` or `reconcile/batch-create`.
3. Fetches `${process.env.REACT_APP_API_URL}/api/zelle/queue?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}` with `Authorization: Bearer ${await firebaseUser.getIdToken()}`, and stores `items` plus `pagination`.
4. Keeps the existing "Sync from Gmail" button (`GET /api/zelle/sync/gmail`), since the sync now only records and matches. Refresh the queue after it resolves.
5. Renders one table with these headers, in this order: `Date/Time`, `Amount`, `Payer`, `Memo`, `Matched Member`, `Match`.
6. For each row:
   - `Date/Time` → `item.payment_date`
   - `Amount` → formatted `item.amount`
   - `Payer` → `item.payer_name` or an em dash
   - `Memo` → `item.note`
   - `Matched Member` → `matchedMember` rendered as `${first_name} ${last_name}`, with `match_source` and `match_confidence` shown as small muted text beneath when present
   - `Match` → if `item.transaction_id` is set, render the matched member as plain text and no control. Otherwise render a numeric member-id input with placeholder `Member ID`, a `Payer name` text input shown only when `item.payer_name` is falsy, and a `Match` button.
7. The `Match` button posts to `${process.env.REACT_APP_API_URL}/api/zelle/queue/${item.id}/match` with `{ member_id: Number(memberId), payer_name: payerOverride || undefined }`, disables while in flight (reuse the existing `busyIds` pattern), and refetches the queue on success. On a non-2xx response, show `data.message` in the existing error banner.
8. Keeps pagination controls driven by `pagination.pages`, the existing text filter input wired to the `search` query param (debounced or applied on submit — either is fine), and a status dropdown wired to the `status` param with options: All, `NEEDS_REVIEW`, `MATCHED`, `AUTO_CREATED`, `CREATED`, `IGNORED`, `ERROR`.

The two load-bearing pieces, to remove ambiguity:

```tsx
const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
        const token = await firebaseUser?.getIdToken();
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search.trim()) params.set('search', search.trim());
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(
            `${process.env.REACT_APP_API_URL}/api/zelle/queue?${params.toString()}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load Zelle emails');
        setItems(data.items || []);
        setPagination(data.pagination || { total: 0, page: 1, pages: 1 });
    } catch (e: any) {
        setError(e.message || String(e));
    } finally {
        setLoading(false);
    }
}, [firebaseUser, page, limit, search, statusFilter]);
```

```tsx
const handleMatch = async (item: QueueItem) => {
    const memberId = Number(matchInputs[item.id]?.memberId);
    if (!memberId) { setError('Enter a Member ID to match.'); return; }

    setBusyIds(prev => ({ ...prev, [item.id]: true }));
    try {
        const token = await firebaseUser?.getIdToken();
        const res = await fetch(
            `${process.env.REACT_APP_API_URL}/api/zelle/queue/${item.id}/match`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    member_id: memberId,
                    payer_name: matchInputs[item.id]?.payerName || undefined
                })
            }
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Match failed');
        await loadQueue();
    } catch (e: any) {
        setError(e.message || String(e));
    } finally {
        setBusyIds(prev => ({ ...prev, [item.id]: false }));
    }
};
```

The Match cell, which encodes the read-only rule:

```tsx
<td className="px-3 py-2">
    {item.transaction_id ? (
        <span className="text-xs text-gray-500">Posted · no changes</span>
    ) : (
        <div className="flex items-center gap-2">
            <input
                type="number"
                placeholder="Member ID"
                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                value={matchInputs[item.id]?.memberId || ''}
                onChange={e => setMatchInputs(prev => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], memberId: e.target.value }
                }))}
            />
            {!item.payer_name && (
                <input
                    type="text"
                    placeholder="Payer name"
                    className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
                    value={matchInputs[item.id]?.payerName || ''}
                    onChange={e => setMatchInputs(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], payerName: e.target.value }
                    }))}
                />
            )}
            <button
                type="button"
                onClick={() => handleMatch(item)}
                disabled={!!busyIds[item.id]}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
            >
                Match
            </button>
        </div>
    )}
</td>
```

Backing state: `const [matchInputs, setMatchInputs] = useState<Record<string, { memberId?: string; payerName?: string }>>({});`

Preserve the file's existing Tailwind class conventions and the `useLanguage`/`useAuth` usage so the screen stays visually consistent with the rest of the treasurer dashboard.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern=ZelleReview`
Expected: PASS (6 tests).

- [ ] **Step 5: Check nothing else referenced the removed props**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. `TreasurerDashboard.tsx` renders `<ZelleReview />` with no props, so it should be unaffected — fix any breakage it reports.

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="TreasurerDashboard|BankTransaction"`
Expected: PASS.

- [ ] **Step 6: Prepare the commit, then ask before running it**

```bash
git add frontend/src/components/admin/ZelleReview.tsx \
        frontend/src/components/admin/__tests__/ZelleReview.test.tsx
git commit -m "feat(zelle): rewrite Zelle review as a read-only payer matching table"
```

---

### Task 10: Show the suggested member and pre-fill approval on Zelle bank rows

**Files:**
- Modify: `frontend/src/components/finance/BankTransactionDetail.tsx`
- Test: `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx` (add cases)

**Interfaces:**
- Consumes: `suggested_match` / `suggested_matches` and `potential_matches` already returned by `GET /api/bank/transactions` for PENDING rows
- Produces: no interface change; the reconcile form's member field defaults to the suggested member.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx`:

```tsx
    test('pre-fills the member field from the learned suggestion on a Zelle row', async () => {
        const txn = {
            ...baseTxn,
            type: 'ZELLE',
            status: 'PENDING',
            amount: 75,
            payer_name: 'SYNTHETIC PAYER',
            suggested_match: {
                source: 'LEARNED_ZELLE',
                confidence: 'high',
                reason: 'Previously associated with this ZELLE payer',
                member: { id: 7, first_name: 'Test', last_name: 'Member' },
            },
        };

        render(<BankTransactionDetail txn={txn as any} onClose={() => {}} onReconciled={() => {}} />);

        expect(await screen.findByDisplayValue('7')).toBeInTheDocument();
        expect(screen.getByText(/Test Member/)).toBeInTheDocument();
        expect(screen.getByText(/Previously associated/)).toBeInTheDocument();
    });

    test('labels the action as approval for a Zelle row', async () => {
        const txn = {
            ...baseTxn,
            type: 'ZELLE',
            status: 'PENDING',
            suggested_match: {
                source: 'LEARNED_ZELLE',
                confidence: 'high',
                reason: 'Previously associated with this ZELLE payer',
                member: { id: 7, first_name: 'Test', last_name: 'Member' },
            },
        };

        render(<BankTransactionDetail txn={txn as any} onClose={() => {}} onReconciled={() => {}} />);
        expect(await screen.findByRole('button', { name: /approve/i })).toBeInTheDocument();
    });
```

Match `baseTxn` and the component's actual prop names to what the existing tests in that file use — read the file's current fixtures first and reuse them rather than inventing new prop shapes.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern=BankTransactionDetail`
Expected: FAIL — the member field is empty and the button is not labelled Approve.

- [ ] **Step 3: Implement**

In `BankTransactionDetail.tsx`:

1. Initialise the reconcile form's member-id state from `txn.suggested_match?.member?.id` when the row is `PENDING`, falling back to empty. Use a `useEffect` keyed on `txn.id` so switching rows re-seeds it:

```tsx
useEffect(() => {
    if (txn.status !== 'PENDING') return;
    const suggestedId = txn.suggested_match?.member?.id;
    setMemberId(suggestedId ? String(suggestedId) : '');
}, [txn.id, txn.status, txn.suggested_match]);
```

Use whatever the component already calls its member-id state setter — read the file before editing and reuse that name rather than introducing `setMemberId` if it differs.
2. Above the member field on a PENDING credit, render a suggestion panel when `txn.suggested_match?.member` exists: the member's name, the `confidence` value, and the `reason` string. Follow the styling of the existing amber "Possible Existing Entry" panel, but use a neutral or blue tone so the two panels are visually distinguishable — the suggestion is informational, the duplicate warning is a caution.
3. When `sourceType` is Zelle (`txn.type` contains `ZELLE`), label the submit button `Approve` instead of the current label; leave the label unchanged for other types.

Do not change the request body or endpoint — approval continues to post to `POST /api/bank/reconcile` exactly as today, so `learnBankMemoMatch` still runs and corrections feed back.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern=BankTransaction`
Expected: PASS, including the pre-existing tests in both bank files.

- [ ] **Step 5: Run the full frontend suite and typecheck**

Run: `cd frontend && npx tsc --noEmit && CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 6: Prepare the commit, then ask before running it**

```bash
git add frontend/src/components/finance/BankTransactionDetail.tsx \
        frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx
git commit -m "feat(bank): pre-fill and label Zelle reconciliation as treasurer approval"
```

---

### Task 11: Update the ingestion docs

**Files:**
- Modify: `backend/ZELLE_INGESTION.md`
- Modify: `.claude/skills/payment-reconciliation/SKILL.md`

**Interfaces:**
- Consumes: the behavior established in Tasks 1-10
- Produces: documentation only

- [ ] **Step 1: Rewrite the behavioral sections of ZELLE_INGESTION.md**

The document currently states that sync "Creates Transactions only if a member match is found" and describes a Create button in the review workflow. Both are now wrong. Update:

- **Overview**: state that the Gmail path never creates transactions while `ZELLE_GMAIL_CREATE_ENABLED` is false (the default), and that bank reconciliation is the only path that posts money.
- **Gmail Parsing & Ingestion**: sync records every email in `zelle_email_queue` and computes a suggested member; it creates nothing.
- **Reconciliation Workflow**: replace the Create steps with the match workflow — open Treasurer Dashboard → Zelle Review, assign the member (supplying a payer name when the email could not be parsed), then approve the payment in Bank Reconciliation when the Chase CSV is uploaded.
- **Endpoints**: add `POST /api/zelle/queue/:id/match`, document the pagination and `search` params on `GET /api/zelle/queue`, and note that the two create endpoints return 403 while the flag is off.
- Add a short section explaining that Zelle bank credits stay PENDING for approval, that Tier 0 exact-reference linking still runs to absorb the pre-existing Gmail-created backlog, and that ACH and check credits are unaffected.

- [ ] **Step 2: Update the payment-reconciliation skill**

`.claude/skills/payment-reconciliation/SKILL.md` documents the old flow in its "Data flow" and "Manual reconciliation workflow" sections. Update step 3 of Data flow to say the canonical record is created by bank reconciliation, not by the Gmail path, and replace the manual workflow with the match-then-approve sequence. Keep the psql debugging patterns and the sensitive-data caution as they are.

- [ ] **Step 3: Verify no stale instructions remain**

Run: `cd /Users/dawit/development/church/abune-aregawi && grep -rn "reconcile/create-transaction\|Click .Create\|creates Transactions when matched" backend/*.md .claude/skills/ docs/superpowers/`
Expected: hits only in the spec/plan (which describe history deliberately) and in the endpoint reference where the 403 is documented. Fix anything else.

- [ ] **Step 4: Prepare the commit, then ask before running it**

```bash
git add backend/ZELLE_INGESTION.md .claude/skills/payment-reconciliation/SKILL.md
git commit -m "docs: describe Zelle match-only flow and approval-gated bank reconciliation"
```

---

## Final verification

- [ ] Run the whole backend suite: `cd backend && npx jest`
- [ ] Run the whole frontend suite: `cd frontend && CI=true npx react-scripts test --watchAll=false`
- [ ] Typecheck the frontend: `cd frontend && npx tsc --noEmit`
- [ ] Confirm `ZELLE_GMAIL_CREATE_ENABLED` is absent or `false` in the OCI box's `.env`, and decide whether to set `ZELLE_SYNC_ENABLED=true` there — the matching screen has no data unless the sync runs.
- [ ] Walk the flow locally end to end: sync (or seed a queue row) → match a payer on the Zelle screen → upload a Chase CSV containing that payer → confirm the bank row is PENDING with the matched member suggested → approve → confirm exactly one transaction and one ledger entry exist.
