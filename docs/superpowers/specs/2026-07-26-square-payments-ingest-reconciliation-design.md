# Square Payments Ingest & Reconciliation — Design (v1)

**Date:** 2026-07-26
**Status:** Approved design, pending implementation plan
**Owner:** Treasurer/admin financial tooling

## Problem

The church's preferred credit-card channel is Stripe (already integrated with an
online-giving flow and a working webhook). On some occasions, however, credit-card
payments are taken through **Square**, outside of this application — via in-person
Square POS/terminal, Square online checkout / payment links, or a mix. Those payments
are currently invisible to the church management system: they don't appear in member
statements, weekly collection reports, income GL totals, or the ledger export.

We want to:

1. Receive Square payments in near-real-time via a Square **webhook**.
2. Persist every completed payment to a dedicated table (audit trail + review queue).
3. Attempt to match each payment to a member (auto when Square gives us buyer info,
   manual otherwise).
4. Provide a **reconciliation page** where a treasurer/admin confirms or corrects the
   match; confirming turns the payment into a first-class `Transaction` + `LedgerEntry`.

This mirrors the existing **Zelle** reconciliation feature almost exactly, and reuses
the same matching/learning engine and the same Stripe-webhook wiring pattern.

## Key constraints & decisions

- **Capture channels:** in-person POS/terminal, online checkout / payment links, and a
  mix. POS taps frequently carry **no buyer name/email** — so **manual reconciliation is
  the common path** and auto-match is a bonus that only fires when Square supplies buyer
  info. The design must degrade gracefully to manual.
- **Integration depth (decided):** a confirmed Square payment becomes a full
  `Transaction` (`payment_method='credit_card'`) **and** a `LedgerEntry`, so it flows
  into statements, reports, income GL codes, and the ledger export — exactly like Zelle.
  Square payments are **not** a parallel silo.
- **Matching strategy (decided):** reuse the existing fuzzy/learned matcher
  (`findSuggestionCandidates` in `bankMemoMatchService`) that Zelle uses, keyed on buyer
  name/email when present. Treasurer confirmations **learn** the association for next time.
- **Ingestion posture (decided): Approach A — webhook + on-demand API backfill.** Webhook
  for immediacy; a `ListPayments` backfill for reliability, because pushes get missed
  (misconfiguration, deploy windows, the OCI nginx 60s proxy timeout). This matches the
  Zelle reliability posture, where the source of truth is a *poll*, not a push.
- **Credentials (decided):** Square Developer account is available; build **sandbox-first**,
  then production.
- **Refunds (decided): deferred to a later phase.** v1 records completed payments only.
  Refund/dispute/other webhook events are safely acknowledged and logged but take no
  action (mirrors the Stripe handler's `default` case), so they never error.

## Precedents reused (do not re-derive)

| Concern | Existing implementation to mirror |
|---|---|
| Persistent ingest queue + audit table | `zelle_email_queue` / `backend/src/models/ZelleEmailQueue.js` |
| Raw-body, signature-verified webhook mounted before JSON parser | `backend/src/server.js:140-141` + `donationController.handleWebhook` |
| Match → confirm → create Transaction + LedgerEntry + learn | `backend/src/services/zelleTransactionService.js` (`createZelleTransaction`, `matchZelleSender`, `learnZelleAssociation`) |
| Fuzzy/learned member matcher | `findSuggestionCandidates` / `learnBankMemoMatch` in `bankMemoMatchService` |
| Reconciliation UI (row search, manual donor, batch, ignore) | `frontend/src/components/admin/ZelleReview.tsx` |
| Reconciliation routes (auth + treasurer/admin role) | `backend/src/routes/zelleRoutes.js` |
| Idempotency by `external_id` unique index | `transactions.external_id` unique index; Stripe/Zelle both rely on it |

## Architecture

Four pieces, each with a proven counterpart:

1. **`square_payments` table** — persistent ingest queue + audit trail.
2. **`POST /api/square/webhook`** — signature-verified, raw-body, real-time ingest.
3. **`squarePaymentService`** — matching + `createSquareTransaction` (Transaction +
   LedgerEntry + learn association).
4. **`SquareReview` frontend page** + **`/api/square/*` reconciliation routes**
   (treasurer/admin only).

## Data model — `square_payments` (new migration)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `UUIDV4` default |
| `square_payment_id` | STRING(191) | **unique**; Square's payment id (idempotency key) |
| `order_id` | STRING(191), nullable | Square order id when present |
| `location_id` | STRING(64), nullable | Square location |
| `amount` | DECIMAL(10,2) | dollars (converted from Square minor units) |
| `currency` | STRING(3) | e.g. `USD` |
| `square_created_at` | DATE | payment time reported by Square |
| `buyer_name` | STRING(255), nullable | often empty for POS |
| `buyer_email` | STRING(255), nullable | often empty for POS |
| `note` | TEXT, nullable | Square note/description |
| `card_brand` | STRING(40), nullable | e.g. `VISA` |
| `card_last4` | STRING(8), nullable | last 4 digits |
| `status` | STRING(20) | `NEEDS_REVIEW`/`AUTO_MATCHED`/`CREATED`/`IGNORED`/`REFUNDED`/`ERROR`; default `NEEDS_REVIEW` |
| `matched_member_id` | BIGINT, nullable | resolved member |
| `match_confidence` | STRING(20), nullable | `high`/`medium`/… |
| `match_source` | STRING(60), nullable | e.g. `LEARNED_*`, fuzzy source |
| `transaction_id` | BIGINT, nullable | FK to `transactions` once created |
| `raw` | JSONB | full Square payload for audit/debug |
| `processed_at` | DATE, nullable | when a transaction was created / row resolved |
| `error` | TEXT, nullable | processing error, if any |

Indexes: unique on `square_payment_id`; non-unique on `status` and `matched_member_id`.

**No change to `Transaction` enums.** Square payments ride as
`payment_method='credit_card'` with `external_id='square:<square_payment_id>'`. This
distinguishes them from Stripe (`external_id` = payment_intent id) while keeping the
existing unique `external_id` index as the idempotency guard.

Status lifecycle:

- `NEEDS_REVIEW` — ingested, no confident match (default; POS taps land here).
- `AUTO_MATCHED` — ingested with a confident learned match; still awaits treasurer confirm.
- `CREATED` — treasurer confirmed; a `Transaction` exists and `transaction_id` is set.
- `IGNORED` — treasurer dismissed the row (no transaction).
- `REFUNDED` — reserved for the future refunds phase (not written in v1).
- `ERROR` — processing failed; see `error`.

## Ingest flow (webhook)

1. `POST /api/square/webhook` is mounted with `express.raw({ type: 'application/json' })`
   **before** the JSON body parser — identical to `server.js:140-141` for Stripe — so the
   raw bytes survive for signature verification.
2. Verify Square's `x-square-hmacsha256-signature` header: HMAC-SHA256 over
   (`SQUARE_WEBHOOK_URL` notification URL + raw body) using `SQUARE_WEBHOOK_SIGNATURE_KEY`,
   base64-encoded, constant-time compared. On mismatch/absent → `400`, no DB write.
3. Dispatch on event type:
   - `payment.created` / `payment.updated`: if the payment `status === 'COMPLETED'`,
     upsert a `square_payments` row keyed by `square_payment_id` (idempotent). Extract
     amount (minor units → dollars), buyer name/email, note, card brand/last4, location,
     order id, timestamps, and stash the full payload in `raw`.
   - Any other event (`refund.created`, disputes, etc.): acknowledge `200` and log; no
     action in v1 (mirrors Stripe handler `default`).
4. After upsert, if `buyer_name` or `buyer_email` is present, run the value through
   `findSuggestionCandidates` (the Zelle/bank matcher). A confident **learned** hit →
   `status='AUTO_MATCHED'` with `matched_member_id`/`match_confidence`/`match_source`.
   Otherwise leave `NEEDS_REVIEW`. Missing buyer info → straight to `NEEDS_REVIEW`.
5. Respond `200 { received: true }` quickly; heavy work stays minimal to respect the
   OCI 60s proxy timeout.

## Ingest flow (backfill)

- `POST /api/square/sync` (treasurer/admin) accepts a date range and calls Square
  `ListPayments` for that window, upserting every returned payment through the **same**
  idempotent upsert path as the webhook.
- Because the upsert is keyed on `square_payment_id`, re-running the backfill creates
  nothing new and never double-posts — it only fills gaps left by missed webhooks.
- Requires `SQUARE_ACCESS_TOKEN`; if absent, the endpoint returns a clear "not configured"
  error rather than crashing.

## Reconciliation flow

- `SquareReview` (modeled on `ZelleReview`) lists rows in `NEEDS_REVIEW` / `AUTO_MATCHED`,
  with a "Sync from Square" date-range button, a text filter, and an "only unmatched" toggle.
- Per row the treasurer can: search + select a member; switch to **anonymous / manual
  donor**; set **payment type**, **membership year** (for `membership_due`), and
  **receipt number** — reusing Zelle's per-row controls.
- **Confirm** (single or batch) → `createSquareTransaction`:
  - Insert-only by `external_id='square:<id>'` (returns `EXISTS`/`409` on a duplicate).
  - Creates `Transaction` (`payment_method='credit_card'`, `status='succeeded'`) and a
    `LedgerEntry` (income category resolved from payment type, same as Zelle).
  - Learns the buyer→member association via `learnBankMemoMatch` so future **Square**
    payments from the same buyer auto-match. Note: the learned keys are namespaced by
    source (`SQUARE:PAYER:…` / `SQUARE:DESCRIPTION:…`), so a Square confirmation does
    **not** train bank/Zelle matching (and vice-versa) — deliberate, to avoid
    cross-source contamination.
  - Sets `transaction_id` on the `square_payments` row and flips `status='CREATED'`.
- **Ignore** → `status='IGNORED'` (only allowed when no transaction exists yet).

## API surface

All under `firebaseAuthMiddleware` + `roleMiddleware(['treasurer','admin'])`, except the
webhook (which is public but signature-verified):

- `POST /api/square/webhook` — Square event ingest (raw body, signature-verified).
- `POST /api/square/sync` — backfill via `ListPayments` for a date range.
- `GET  /api/square/queue?status=&limit=` — list ingested payments for the review page.
- `POST /api/square/reconcile/create-transaction` — confirm one row → Transaction+Ledger.
- `POST /api/square/reconcile/batch-create` — confirm many rows.
- `POST /api/square/queue/:id/ignore` — dismiss a row.

## Error handling

- **Bad/absent signature** → `400`, no DB write.
- **Duplicate `square_payment_id`** → upsert no-ops; the unique index is the guard
  (same reliance as Stripe/Zelle on `transactions.external_id`).
- **Missing Square secrets** → feature disabled with a clear log at startup (mirrors the
  Stripe init guard); webhook/sync return "not configured" rather than throwing.
- **Ledger-entry failure** → logged, never rolls back the created `Transaction`
  (matches Zelle behavior).
- **Webhook vs backfill race** → both use one idempotent upsert keyed on
  `square_payment_id`, so concurrent ingestion can't double-post; the `transactions`
  unique `external_id` index is the final backstop against a double transaction.

## Environment / prerequisites

Square Developer application (sandbox first):

- Subscribe a webhook subscription to `payment.created` and `payment.updated`, pointing
  at the production `SQUARE_WEBHOOK_URL`.
- Env vars (add to `backend/env.example`, never commit real values):
  - `SQUARE_ACCESS_TOKEN` — for `ListPayments` backfill.
  - `SQUARE_WEBHOOK_SIGNATURE_KEY` — for HMAC verification.
  - `SQUARE_ENV` — `sandbox` | `production`.
  - `SQUARE_WEBHOOK_URL` — the exact notification URL Square is configured to call
    (part of the signature payload).

## Testing strategy

Run against `DATABASE_URL=sqlite::memory:` with **fixture (non-real) Square payloads** —
never real member PII/financial data.

- **Unit**
  - Signature verification: valid, invalid, missing header/key.
  - Webhook upsert idempotency: same `square_payment_id` twice → one row.
  - Matcher routing: buyer info with a learned key → `AUTO_MATCHED`; no buyer info →
    `NEEDS_REVIEW`.
  - `createSquareTransaction`: insert-only by `external_id`, creates Transaction +
    LedgerEntry, sets `transaction_id`/`CREATED`, returns `EXISTS` on duplicate.
- **Integration**
  - Webhook POST (valid signature) → `square_payments` row created with parsed fields.
  - Confirm → a `Transaction` (`credit_card`, `external_id='square:…'`) and a
    `LedgerEntry` appear.
  - Backfill re-run over the same window → zero new rows, zero new transactions.

## Out of scope (future phases)

- Automated refund/dispute handling (mark `REFUNDED`, flag a linked transaction rather
  than delete). v1 acknowledges these events but takes no action.
- Household/`family_id` roll-up matching (v1 matches at the individual member level).
- Square Customer directory sync.

## Frontend i18n note

`SquareReview` UI strings must be added to both `en` and `ti` dictionaries
(`frontend/src/i18n/dictionaries.ts`), per the project's bilingual requirement.
