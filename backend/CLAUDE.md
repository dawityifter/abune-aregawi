# backend/CLAUDE.md

Node.js/Express REST API with Sequelize ORM. Production DB: PostgreSQL on Supabase
(`DATABASE_URL`); local/dev can use sqlite (`database.sqlite`, `dev.db`; tests use
`DATABASE_URL=sqlite::memory:`). Deployed to OCI Compute via
`.github/workflows/deploy-backend.yml`. Integrations: Firebase Admin (auth), Stripe
(payments + webhook), Twilio (SMS), JWT, email. See `env.example` for required vars.

## Two migration systems — know which one you want

- `backend/migrations/` (top level, ~65 files) — the **real** one: `sequelize-cli`,
  tracked in `SequelizeMeta`, run automatically by the deploy pipeline. New schema
  changes go here.
- `backend/src/database/migrations/` — legacy ad-hoc scripts (see folder map below).

The `db-migrations` skill covers when to use each.

## Folder map (src/)

- `routes/` -> `controllers/` -> `services/` -> `models/` (Sequelize)
- `middleware/` — auth, roles, etc.
- `database/migrations/` — ~15 ad-hoc scripts run by hand/npm script, NOT tracked in
  `SequelizeMeta`. Legacy; don't add new ones here.
- `scripts/` — operational/one-off scripts
- `jobs/ledgerSheets/` — Google Sheets ledger export job
- `__tests__/` — Jest tests (controllers/, services/)

## Commands (run from backend/)

```
npm run dev              # nodemon src/server.js
npm start
npm test / test:watch / test:coverage / test:unit / test:integration / test:ci
# for direct runs: DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest <file>

npm run db:init / db:reset / db:test / db:sync
npm run db:update-roles
npm run db:migrate:expenses / db:migrate:ledger-fix / db:migrate:ledger-enum / db:migrate:income / db:migrate:ledger-types
npm run db:seed:expenses / db:seed:income
npm run export:ledger:sheets[:preflight|:year|:scheduled]
```

## Topic docs in this folder (read the relevant one before touching that area)

- `API_TESTING_GUIDE.md` — how to exercise the API
- `DATABASE_SETUP.md` — DB setup/config
- `ZELLE_INGESTION.md` — Zelle email ingestion + bank reconciliation pipeline
- `CHURCH_TRANSACTIONS.md` — transactions model/flows
- `EXPENSE_TRACKING_RUNBOOK.md` — expense tracking operations
- `PAYMENT_TYPE_MAPPINGS.md` — payment type mapping rules
- `INCOME_GL_CODES_*.md` — income GL code definitions/mappings
- (other `*.md` siblings cover narrower features — check filenames before re-deriving)

## Sensitive data — important

Tables like `bank_transactions`, `zelle_email_queue`, `bank_memo_matches`,
`member_loans`, `pledges`, `transactions`, `ledger_entries` hold real member financial
data. Never put real member PII/financial rows into tests, docs, fixtures, or commits.
Treat the production `DATABASE_URL` as dangerous: no destructive psql/scripts against it
without explicit user instruction; default to sqlite for local work and tests.
