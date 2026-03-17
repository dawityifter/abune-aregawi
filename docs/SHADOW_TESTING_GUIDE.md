# Java Backend Shadow Testing Guide

## What We Are Doing

We are migrating from a Node.js/Express backend to a Java/Spring Boot backend while keeping the frontend unchanged. Before switching traffic to Java, we run both backends side-by-side and compare their responses automatically — this is called **shadow testing**.

The Node.js backend continues to serve all real user traffic. Every eligible GET request is silently replayed against the Java backend in the background. Responses are compared and any differences are written to log files for review.

**Goal:** Confirm the Java backend returns identical (or acceptably equivalent) responses to Node.js before switching `REACT_APP_API_URL` to point at Java.

---

## Architecture

```
Browser / Frontend
       |
       | (all real traffic)
       v
Node.js Backend (port 5001)  ──── responds to client
       |
       | fire-and-forget (background, never blocks client)
       v
Java Backend (port 8080)  ──── response captured for diff only
       |
       v
shadow-report.log / shadow-errors.log
```

---

## Files

| File | Purpose |
|------|---------|
| `backend/src/shadow/shadowMiddleware.js` | Express middleware — intercepts `res.json()`, forwards request to Java in background |
| `backend/src/shadow/shadowCompare.js` | Fires the Java call, normalizes both responses, diffs them, writes to logs |
| `backend/shadow-report.log` | One JSON line per comparison — match status, diff details |
| `backend/shadow-errors.log` | Errors (Java unreachable, timeout, unexpected failures) |

These files are **local only and must not be committed to main**.

---

## How to Run

### 1. Start the Java backend

```bash
cd backendJava
./gradlew bootRun
```

Java must be running on port 8080. Confirm with:
```bash
curl http://localhost:8080/health
```

### 2. Start the Node.js backend in shadow mode

```bash
cd backend
SHADOW_MODE=true node src/server.js
```

Without `SHADOW_MODE=true` the shadow middleware is a no-op — normal production starts are unaffected.

### 3. Use the app normally

Open the frontend at `http://localhost:3000` and use it as normal — load member lists, payments, transactions, etc. Every GET request to a shadowed route automatically fires a background comparison.

You can also trigger comparisons directly with curl:
```bash
curl -H "Authorization: Bearer <firebase-token>" \
  http://localhost:5001/api/members
```

---

## Shadowed Routes

All routes with Java equivalents are included. `/api/members/statement` is excluded because it returns binary PDF data, not JSON.

```
/api/members
/api/payments
/api/transactions
/api/donations
/api/zelle
/api/groups
/api/departments
/api/pledges
/api/expenses
/api/gallery
/api/income-categories
/api/employees
/api/vendors
/api/activity-logs
/api/volunteers
/api/bank
/api/announcements
/api/settings
/api/sms
/api/youtube
/api/twilio
```

Only GET requests are shadowed. POST/PUT/DELETE are never forwarded — the Java backend is read-only during this phase.

---

## Reading the Logs

### Quick summary

```bash
cat backend/shadow-report.log | node -e "
const rl = require('readline').createInterface({ input: process.stdin });
rl.on('line', l => {
  const e = JSON.parse(l);
  const icon = e.match ? '✅' : '❌';
  console.log(icon, e.path.padEnd(50), 'diffs:', e.diffCount, ' node:', e.nodeStatus, ' java:', e.javaStatus);
});
"
```

### Per-route match rate

```bash
cat backend/shadow-report.log | node -e "
const rl = require('readline').createInterface({ input: process.stdin });
const stats = {};
rl.on('line', l => {
  const e = JSON.parse(l);
  const route = e.path.split('?')[0];
  if (!stats[route]) stats[route] = { pass: 0, fail: 0 };
  e.match ? stats[route].pass++ : stats[route].fail++;
});
rl.on('close', () => {
  for (const [r, s] of Object.entries(stats).sort()) {
    const total = s.pass + s.fail;
    const pct = Math.round(s.pass / total * 100);
    console.log(pct === 100 ? '✅' : '❌', r.padEnd(50), pct + '%', '(' + total + ' calls)');
  }
});
"
```

### Inspect diffs for a specific route

```bash
cat backend/shadow-report.log | node -e "
const rl = require('readline').createInterface({ input: process.stdin });
rl.on('line', l => {
  const e = JSON.parse(l);
  if (!e.match && e.path.includes('/api/members')) {
    console.log(JSON.stringify(e.differences, null, 2));
  }
});
" | head -100
```

### Errors (Java unreachable, timeouts)

```bash
cat backend/shadow-errors.log
```

### Clear logs and start fresh

```bash
rm -f backend/shadow-report.log backend/shadow-errors.log
```

---

## Diff Format

Each log entry in `shadow-report.log` is a JSON object:

```json
{
  "time": "2026-03-16T15:00:00.000Z",
  "method": "GET",
  "path": "/api/members?page=1&limit=20",
  "nodeStatus": 200,
  "javaStatus": 200,
  "match": false,
  "diffCount": 3,
  "differences": [
    { "kind": "E", "path": ["data", 0, "phoneNumber"], "lhs": "+1234567890", "rhs": "1234567890" }
  ],
  "requestId": "uuid"
}
```

Diff `kind` values (from the `deep-diff` library):
- `N` — property added in Java that Node doesn't have
- `D` — property present in Node but missing from Java
- `E` — value differs between Node and Java (`lhs` = Node, `rhs` = Java)
- `A` — array item changed

---

## Fixing Parity Issues

When a diff is found:

1. Note the `path` array in the diff — it tells you exactly which field in which object differs
2. Check the Node.js controller/model for that route
3. Check the equivalent Java controller/service
4. Fix the Java side to match Node.js behavior
5. Re-run and confirm the diff disappears

Common causes of diffs:
- **Field naming**: Java uses camelCase by default; Node.js may return snake_case (or vice versa)
- **Null vs missing**: Java may return `"field": null`; Node.js may omit the field entirely
- **Number types**: Java returns integers; Node.js returns strings (or vice versa)
- **Date formats**: Java `LocalDate` vs Node.js `Date.toISOString()`
- **Pagination wrapper**: Java wraps in `ApiResponse<T>`; Node.js may return different envelope structure
- **Extra fields**: Java DTO includes fields not in Node.js response (or vice versa)

---

## Definition of Done

Shadow testing is complete when:
- [ ] All shadowed routes show 100% match rate over a representative session
- [ ] `shadow-errors.log` is empty (no Java timeouts or crashes)
- [ ] POST/mutation paths have been manually spot-checked
- [ ] `REACT_APP_API_URL` switched to Java and smoke-tested
