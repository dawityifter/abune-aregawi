# Event Merchandise Sales (t-shirts)

Stripe Checkout flow for selling merchandise at church events — built for the
October 5K fundraiser, but the catalog is keyed by event so later events reuse it.

**A merchandise sale is not a donation.** It never touches the donation or pledge
code paths, never writes a `donations` row, never creates a pledge or a pledge
allocation, and never links to a member — so it cannot appear on a giving
statement or in charitable-giving totals.

## Money path

```
public order form  ->  POST /api/merch/checkout-session  ->  Stripe Checkout (hosted)
                              |                                       |
                       merch_orders (pending)                 checkout.session.completed
                       merch_order_items                              |
                                                     POST /api/merch/webhook
                                                              |
                                        merch_orders (paid) + transactions + ledger_entries
```

- `payment_type` / ledger `type`: **`event_merchandise`**
- GL code: **INC012 — Event Merchandise Sales**
- `Transaction.member_id` is always `null`; the buyer's name goes in `donor_name`
  (that column is "the non-member counterparty", the same way anonymous gifts use it).
- `Transaction.external_id` is the Stripe **payment intent** id, under the existing
  UNIQUE index — this is what makes a redelivered webhook a no-op.

### Why a new payment type instead of `religious_item_sales`

INC009 (`religious_item_sales`) is the Bibles, candles and articles sold from the
church year-round. Event merchandise is a fundraiser's own inventory, and the
treasurer needs the two separable on a report without reading transaction notes.

## Webhook

Its **own endpoint with its own signing secret** — `STRIPE_MERCH_WEBHOOK_SECRET`,
not the donation one. Add `/api/merch/webhook` as a separate endpoint in the
Stripe dashboard, subscribed to `checkout.session.*`, and paste its secret.

Mounted in `server.js` **before the body parsers** (`express.raw`), like the
donation and Square webhooks — signature verification needs the raw body.

Idempotent on three independent levels, because Stripe delivers at least once and
redelivers on every non-2xx:

1. an order already `paid` returns immediately;
2. the `Transaction` is looked up by `external_id` (UNIQUE);
3. the `LedgerEntry` is looked up by `transaction_id`.

The order and its transaction commit in one DB transaction. The ledger entry is
best-effort after it, matching the donation controller: a ledger failure must not
un-record a payment Stripe already captured, and ledger entries can be backfilled.

## Sales tax — READ BEFORE THE EVENT

**A Texas nonprofit's merchandise SALES are not automatically exempt from sales
tax just because the seller is a church.** Texas does provide relief in specific
circumstances — notably the two one-day tax-free sale days an exempt organization
may claim per calendar year, and certain qualifying fundraiser rules — but whether
a given event qualifies is a determination about *that event*, not a property of
the organization.

The default therefore **charges** tax. Assuming exemption and being wrong means
the church owes uncollected tax out of its own funds; charging when exempt is a
refund. The safer error is the recoverable one.

**Church admins: confirm the rate and the exemption question with the parish
treasurer or accountant before the event.** Nothing here is tax advice.

| `MERCH_TAX_MODE` | Behaviour |
|---|---|
| `manual` (default) | Applies `MERCH_TAX_RATE_BPS` as its own visible Checkout line. Needs no Stripe Tax setup. |
| `automatic` | Hands the calculation to Stripe Tax (`automatic_tax`). **Requires Stripe Tax enabled and a Texas registration on the account, or session creation fails outright.** |
| `none` | Charges nothing. Only with a documented exemption for the event. |

`MERCH_TAX_RATE_BPS` is basis points: `825` = 8.25% (TX state 6.25% + the 2% local
maximum that applies in Garland). An unrecognised mode falls back to `manual`, not
`none` — a typo must not become a silent tax holiday. An out-of-range rate throws.

The ledger entry records the **gross** amount (tax included) so it ties to the
Stripe payout, with the tax portion called out in the memo. If the treasurer wants
tax split to a separate liability account instead, that is a different journal
entry and a deliberate decision — it is not what this does today.

## Pricing and the catalog

`src/config/merchCatalog.js` is the **only** place a price lives. The checkout
endpoint is public, so the server prices every line from the catalog and ignores
any price in the request body — otherwise anyone could buy a $25 shirt for a penny
by editing the request. Prices are in cents; `max_quantity_per_size` is a sanity
ceiling, not a stock count (nothing here reserves inventory).

**Price is per SIZE, not per product.** There is deliberately no product-level
`unit_amount` — sizes cost different amounts, and a product-wide default is the
field a caller reaches for by habit and silently misprices larger shirts with.

Current run for the October 5K: **S $25.00, L $30.00**. Changing the prices or the
size run is an edit to the `sizes` array in that file and nothing else. Past orders
keep the price they were sold at — `merch_order_items.unit_amount` is a per-line
snapshot, which is what made per-size pricing a no-migration change.

## Payment methods on the Checkout page

Card only, stated explicitly in the session:

```js
payment_method_types: ['card'],
wallet_options: { link: { display: 'never' } },
```

Omitting `payment_method_types` hands the choice to Stripe's **dynamic payment
methods**, which render whatever the Dashboard has enabled — Klarna, Affirm, Cash
App, Link. Buy-now-pay-later financing on a $25 parish fundraiser shirt is not
something the church offers, and it meant a Dashboard toggle could change the
checkout page with no deploy. The donation flow (a plain `CardElement`) shows
none of these, so this keeps the two consistent.

`wallet_options.link.display: 'never'` also removes the **"Save my information
for faster checkout"** opt-in, which otherwise asks someone buying one t-shirt to
create a Stripe-wide account.

**Apple Pay is a Dashboard setting, not code**: Settings → Checkout → *Use Apple
Pay*. It rides along with the `card` payment method type and has no per-session
parameter. It is turned off so merch matches the donation and pledge pages.

**Wallets cannot be reordered.** Hosted Checkout renders express wallet buttons
above the card form by design and exposes no parameter to move them below it.
(`paymentMethodOrder` is a Payment *Element* option, not a hosted-Checkout one.)
The only levers are show or hide; controlling layout would mean migrating to
embedded Elements and putting card fields back on our own domain.

## Fulfillment

**Pickup only.** No shipping address is collected and no shipping is offered;
shirts are handed over at the church or at the event.

Admin UI: AdminDashboard → **Merchandise** tab (`components/admin/MerchOrders.tsx`).
Roles mirror `merchAdminRoles` in `routes/merchRoutes.js`: admin, treasurer,
church_leadership, secretary, bookkeeper.

| Endpoint | Purpose |
|---|---|
| `GET /api/merch/catalog` | Public. Sizes with their individual prices, for the order page. |
| `POST /api/merch/checkout-session` | Public, rate-limited. Opens Checkout. |
| `GET /api/merch/orders` | Staff. Filter by `status`, `fulfillment_status`, `event_key`. |
| `GET /api/merch/orders/size-summary` | Staff. **How many of each size to have printed.** Paid orders only. |
| `PATCH /api/merch/orders/:id/fulfillment` | Staff. Mark collected / undo. Refuses unpaid orders. |

The size summary counts **paid orders only** — printing shirts for a pending order
(a browser tab someone left open at the payment screen) is a real cost.

## Frontend

- `/merch` — public order page (`pages/MerchPage.tsx`)
- `/merch/thank-you` — Stripe's `success_url` return

Hosted Checkout, so no card details are entered on the site and Stripe.js is never
loaded on these routes — unlike `/donate` and `/pledge`, which use Stripe Elements.

## Migrations

| File | What |
|---|---|
| `20260919000001-add-event-merchandise-payment-type.js` | Adds `event_merchandise` to the `transactions` (and `ledger_entries`) payment-type enums and seeds INC012. Postgres only; no transaction wrapper — a new enum value is not usable until commit. |
| `20260919000002-create-merch-orders.js` | `merch_orders` + `merch_order_items`. |

The ledger-enum `ALTER TYPE` is inside a `try/catch` (same precedent as the
pledge_drive migration). **If it fails in production, merchandise ledger entries
will fail to insert** — the transaction still records, and the error is logged
loudly, but check the migration output on deploy.

## Tests

- `src/__tests__/services/merchPricing.test.js` — validation, per-size pricing (mixed-size totals), client-price rejection
- `src/__tests__/database/merchOrdersMigration.test.js` — builds the schema from the MIGRATION rather than `sync()`, so a migration that disagrees with the model is caught before production
- `src/__tests__/services/merchTax.test.js` — tax modes, rounding, the charging default
- `src/__tests__/controllers/merchController.test.js` — checkout validation, order creation, **webhook idempotency**
- `src/__tests__/controllers/merchAdmin.test.js` — size summary, filters, fulfillment, auth guards
- Frontend: `src/components/merch/__tests__/ShirtOrderForm.test.tsx`

All use synthetic purchasers. Never put real member data in these.
