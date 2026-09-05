# CLAUDE.md — Abune Aregawi Church Management System

Bilingual (English/Tigrigna) church management system for Debre Tsehay Abune Aregawi
Tigray Orthodox Tewahedo Church (Dallas): member registration, dependents/children,
online giving (Stripe), financial tracking/ledger, Zelle reconciliation, SMS (Twilio),
role-based access. Auth is Firebase; frontend deploys to Firebase Hosting, backend to
OCI Compute via GitHub Actions (`.github/workflows/`).

## Monorepo map

| Dir | What | Details |
|---|---|---|
| `frontend/` | React + TypeScript (CRA) app | see `frontend/CLAUDE.md` |
| `backend/` | Node/Express + Sequelize + PostgreSQL API | see `backend/CLAUDE.md` |
| `backendJava/` | WIP Gradle project, **no src/main yet — not a working service** | see `backendJava/CLAUDE.md` |
| `docs/` | ~60 historical implementation notes/summaries — reference archive, do not read wholesale. Start with `docs/Objective.md` (product goals) and `docs/CLEAN_ARCHITECTURE.md` |
| `scripts/` | one-off data utilities (CSV cleanup, member import, phone lists) + `pre-commit.sh` |

## Root commands

```
npm run dev              # frontend + backend concurrently
npm run dev:frontend / dev:backend
npm run build            # frontend build
npm run install:all      # root + frontend + backend deps
npm run test             # backend tests then frontend tests
npm run test:backend / test:frontend
npm run emulators        # firebase auth emulator (via frontend)
```

## Sensitive data — important

This app manages real member PII and financial data (dues, pledges, loans, bank/Zelle
transactions, reconciliation tables like `bank_transactions`, `zelle_email_queue`,
`member_loans`, `ledger_entries`). Rules:

- Never commit real member names, phones, or financial records into code, tests, docs, or commits.
- Be careful with anything touching the production DATABASE_URL (Supabase Postgres) —
  prefer local sqlite (`DATABASE_URL=sqlite::memory:` for tests) unless explicitly asked.
- Secrets live in `.env` files / env.example templates — never hardcode.

## Where to look

- `README.md` — architecture mermaid diagram, project overview.
- `backend/*.md` — topic docs (API testing, DB setup, Zelle ingestion, expense tracking,
  GL codes, payment mappings). Listed in `backend/CLAUDE.md`.
- `frontend/FIREBASE_SETUP.md`, `frontend/docs/` — frontend-specific setup notes.
- `.claude/skills/` — reusable procedures, once created; check there before re-deriving a workflow.

## Conventions

- No repo-wide ESLint/Prettier config or CONTRIBUTING.md. Frontend uses CRA's built-in
  `react-app` eslintConfig (in `frontend/package.json`). Match surrounding code style.
