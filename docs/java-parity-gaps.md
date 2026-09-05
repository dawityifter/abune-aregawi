# Java backend — parity gaps

**As of 2026-09-05.** What the Spring Boot port on the `java` branch still needs
before it could stand in for the Node backend. Written after merging `main` into
`java` (332 commits, six months of divergence) and porting the financial core.

The Node backend under `backend/` is the source of truth throughout. Its 81
Sequelize migrations own the schema; nothing in `backendJava/` may create or
alter a table.

---

## Read this first: why the existing specs did not catch any of this

Every Spock spec in this project mocks its repository. That is fine for
branching logic, but it means **no test had ever built SQL against the real
schema**, and so a whole class of defect survived: entities mapping columns that
do not exist, entities missing columns that are NOT NULL, and enum bindings
Postgres rejects. All three were present, and each broke an entire category of
operation.

The fix is not to stop mocking. It is that anything touching persistence needs
at least one test that reaches a database — `AbstractIntegrationTest` provides
one, against a throwaway built from a schema-only dump.

---

## Fixed in this pass

| Defect | Effect before the fix |
|---|---|
| 15 entity fields bound Postgres named enums as varchar | Every INSERT into members, transactions, donations, pledges, sms_logs and 10 other tables failed |
| `Member` declared six of `Dependent`'s columns | Every read of any member failed: `column m1_0.allergies does not exist` |
| `Pledge` mapped a `status` column that does not exist, and omitted NOT NULL `campaign_id` | Pledges could be neither read nor written |
| `PledgeCampaign` and `PledgeAllocation` had no entities | The entire campaign/allocation subsystem was unreachable |
| `Transaction.collector` was `nullable = false` | Anonymous online gifts — the reason the Node migration dropped that constraint — were rejected |
| `findByStatus(pending)` drove SMS reminders | Crashed; and the obvious repair would have texted members who had already paid |

`SchemaGapReportTest` now fails the build if any entity declares a column no
table has. That count is **0**, down from 7.

---

## Not ported: tables with no Java entity

| Table | Feature | Notes |
|---|---|---|
| `square_payments` | Square reconciliation | Whole ingest + matching flow absent |
| `survey_responses` | Church services survey | `SurveyController` absent; Node has definitions, validation and a report |
| `zelle_email_queue` | Zelle ingestion | The Gmail OAuth path exists in `ZelleGmailService`, but the queue table it feeds does not map |
| `bank_memo_matches` | Bank reconciliation | Memo-matching audit trail |
| `expense_memo_matches` | Expense reconciliation | As above |
| `church_transactions` | Legacy financial table | Confirm whether still needed before porting |
| `member_payments_2024` | Frozen 2024 dues | Historical; may be intentionally out of scope |

---

## Not ported: endpoints Node has and Java does not

- `pledgeCampaign` — create, list, activate/close, totals. **Entities and
  repositories now exist; the service and controller do not.** The rule to
  carry over: a campaign is live only when active *and* inside its window, and
  activating one whose end date has passed must be refused rather than reported
  as success (`CAMPAIGN_WINDOW_PASSED`). `PledgeCampaign.isLive` already encodes
  the predicate.
- `pledgeAllocation` — allocate, reverse, unallocated queue. Entity and
  repository exist; no service or controller. Reversal is an insert of a
  negative row with a reason, never an update.
- `square` — ingest and reconciliation.
- `survey` — definitions, submission, report.

## Endpoints Java has that Node does not

`Outreach`, `Report`, `PaymentStats`, `MemberDepartment`, `ExpenseCategory`,
`Health`. Some are genuine additions; confirm which are wanted before treating
their absence from Node as a gap in the other direction.

---

## Behavioural gaps inside ported code

### Dependents are stored as members

`MemberService.addDependent` does `Member dependent = new Member()` and gives it
a fabricated `DEP-<uuid>` phone number to satisfy the unique constraint. Node has
a `dependents` table and a `Dependent` model, and this port has a `Dependent`
entity that goes unused on this path. The method is also littered with
unresolved thinking-aloud comments ("I will add relationship field later",
"Or store relationship here?").

Porting it properly means writing to `dependents`. Until then, the six
health/notes fields the frontend sends are dropped on the floor.

### Pledge intent and anonymity are stored but not enforced

The columns map, and `PledgeFulfillmentDerivationTest` covers the arithmetic,
but none of the *rules* are implemented in Java:

- A pledge for later must have a signed-in member; `member_id` comes from the
  token, never from an email or phone guess.
- Anonymity is only available when the money arrives with the pledge.
- An anonymous donor's name must be masked everywhere outside admin and
  treasurer — including the notes field and the parish inbox.
- One active pledge per member per campaign; a repeat is a 409.

The database enforces the last of those and two CHECK constraints
(`pledges_anonymous_requires_immediate`,
`pledges_anonymous_is_identifiable`), so a violation fails loudly rather than
silently. The masking has no such backstop and is the one to be careful with.

### Money-path rules the database taught us

Discovered while writing tests, worth knowing before porting further:

- `pledge_allocations.source` is limited by CHECK to `stripe_auto`,
  `treasurer_manual`, `migration`, `stripe_refund`. Zelle, bank and Square
  allocation each need that CHECK widened — a Node migration, not a Java change.
- Cash and check transactions require a receipt number
  (`check_receipt_for_cash_check`).
- `pledge_allocations` blocks UPDATE and DELETE by trigger.

---

## Infrastructure

- **No CI.** Nothing builds or tests this branch. `.github/workflows/` has
  pipelines for `frontend/**` and `backend/**` only.
- **No deployment.** No DNS, no process manager entry, nothing.
- **`ddl-auto` was `update`.** Now `none`, overridable only by environment. It
  must never go back: Hibernate would silently ALTER the tables the Sequelize
  migrations own — no migration file, no review, no `SequelizeMeta` row.
  Against production that would rewrite the parish's financial tables.
- **37 column-width mismatches remain**, nearly all `varchar(255)` against a
  shorter column. Harmless to Hibernate, but clearing them would let
  `application-test.yml` use `ddl-auto: validate` and retire
  `SchemaGapReportTest` in favour of the context simply refusing to start.

---

## Suggested order

1. **Pledge campaign + allocation services and controllers.** Entities and
   repositories are done; this is the largest user-visible gap remaining, and
   the money rules above are the specification.
2. **Dependents.** Rewrite `addDependent` against the `dependents` table.
3. **Anonymity masking**, with tests covering every leak vector — Node's suite
   names four.
4. **Survey, Square, Zelle queue** — self-contained, and none of them touch the
   money paths.
5. **Column widths**, then switch the test profile to `validate`.
6. **CI** for the branch, so the 195 tests run on push.
