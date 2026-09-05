# Year-End Contribution Statement — Design

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Members can generate their Year-End Contribution Statement from the `/dues` page. Two actions are supported:

1. **Print Statement** — downloads a PDF the member can print themselves.
2. **Email Statement** — generates the same PDF and sends it as an email attachment. Only shown when the member has an email address on file.

---

## Architecture

### New Backend Endpoints

Both are authenticated with Firebase token (same middleware as existing dues endpoints).

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/members/statement/pdf?year=YYYY` | Stream PDF as download |
| `POST` | `/api/members/statement/email` | Generate PDF and send as email attachment |

### New Files

| File | Purpose |
|------|---------|
| `backend/src/controllers/statementController.js` | Handles both endpoints; fetches data, generates PDF, sends or streams |
| `backend/src/routes/statementRoutes.js` | Registers routes with Firebase auth middleware |
| `backend/src/services/emailService.js` | Nodemailer/Gmail OAuth2 wrapper (reusable) |

---

## Data Source

Query `transactions` joined with `income_categories`, filtering to tax-deductible GL codes only.

```sql
SELECT t.payment_date, t.amount, ic.name AS category, t.receipt_number, t.note
FROM transactions t
INNER JOIN income_categories ic ON t.income_category_id = ic.id
WHERE t.member_id = :memberId
  AND COALESCE(t.for_year, date_part('year', t.payment_date)) = :year
  AND t.status = 'succeeded'
  AND ic.gl_code IN ('INC001','INC002','INC003','INC004','INC008')
ORDER BY t.payment_date ASC
```

**Tax-deductible GL codes:** INC001, INC002, INC003, INC004, INC008
**Excluded (non-deductible):** INC005, INC007
**Excluded (no GL code):** Transactions without `income_category_id` are omitted — tax status cannot be determined.

The `for_year` field is respected so payments made in a different calendar year (e.g. Jan 2026 payment for 2025) are attributed correctly.

Member data (name, spouse_name, email) is fetched from the `members` table.

---

## PDF Layout (PDFKit)

Generated entirely in-memory — no temp files written to disk.

```
┌─────────────────────────────────────────────┐
│  [Church Logo]  Debre Tsehay Abune Aregawi  │  ← Header (every page)
│                 Orthodox Tewahedo Church     │
│                 1621 S Jupiter Rd, Garland TX│
├─────────────────────────────────────────────┤
│  Date: [CURRENT_DATE]                        │
│                                              │
│  Dear [MEMBER_NAME] & [SPOUSE_NAME],         │
│  (spouse line omitted if no spouse on file)  │
│                                              │
│  [Letter body from approved template]        │
│                                              │
│  ┌──────────────┬──────────────┬──────────┐  │
│  │ Date         │ Category     │ Amount   │  │
│  ├──────────────┼──────────────┼──────────┤  │
│  │ Jan 15, 2025 │ Membership   │  $50.00  │  │
│  │ Mar 02, 2025 │ Tithe        │ $200.00  │  │
│  ├──────────────┴──────────────┼──────────┤  │
│  │ Total Contributions [YEAR]  │ $250.00  │  │
│  └─────────────────────────────┴──────────┘  │
│                                              │
│  Sincerely,                                  │
│  Debre Tsehay Abune Aregawi Church           │
├─────────────────────────────────────────────┤
│  Page N of M  ·  Confidential               │  ← Footer (every page)
└─────────────────────────────────────────────┘
```

**Letter body (print/download):**

> We thank God for you! Your gifts to Debre Tsehay Abune Aregawi Orthodox Tewahedo Church throughout the year are gratefully acknowledged.
>
> Because of your contributions, our congregation has been able to continue the work of our Lord Jesus Christ in the community. Your generosity helps maintain our church building, support our ministries, and sustain the worship and sacramental services of our parish.
>
> Below is an itemized statement of your contributions for the year [YEAR] according to our records. If you have any concerns regarding the accuracy of this information, please contact us.
>
> For income tax purposes, please note that you did not receive any goods or services in return for these contributions other than intangible religious benefits.

---

## Email Service

- **Transport:** Gmail OAuth2 using existing `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` env vars
- **From:** `Debre Tsehay Abune Aregawi Church <abune.aregawi.dev@gmail.com>`
- **Subject:** `Your Annual Contribution Statement for [YEAR]`
- **Body:** Plain text using the approved email template
- **Attachment:** `Annual_Contribution_Statement_[YEAR].pdf`

**Email body template:**

> Dear [MEMBER_NAME],
>
> Peace and blessings to you.
>
> Please find attached your Annual Contribution Statement for the year [YEAR] from Debre Tsehay Abune Aregawi Orthodox Tewahedo Church.
>
> We are grateful for your generosity and continued support of the Church. Your contributions help sustain the ministry of our Lord Jesus Christ and support the spiritual and community work of our parish.
>
> If you have any questions regarding this statement, please feel free to contact the church administration.
>
> May God bless you and your family.
>
> Sincerely,
> Debre Tsehay Abune Aregawi Orthodox Tewahedo Church

**Error handling:** Gmail send failure returns `502` with a user-friendly message. No silent failures.

---

## Frontend Changes (DuesPage.tsx)

Two buttons added below the payment history table:

| Button | Visibility | Action |
|--------|------------|--------|
| Print Statement | Always | `GET /api/members/statement/pdf?year={selectedYear}` → blob download |
| Email Statement | Only if `member.email` is non-empty | `POST /api/members/statement/email` `{ year: selectedYear }` → success toast |

- Both buttons show a spinner while in-flight and are disabled to prevent double-clicks
- Errors shown as inline message near the buttons
- Year passed to both endpoints matches the currently selected year in the existing toggle

---

## PDF Dependency

Add to `backend/package.json`:

```
pdfkit: ^0.15.x
```

No other new dependencies required.
