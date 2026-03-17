# Year-End Contribution Statement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Print Statement" and "Email Statement" buttons to DuesPage that generate a tax-compliant PDF contribution statement for the selected year.

**Architecture:** Two new backend endpoints (`GET /api/members/statement/pdf` and `POST /api/members/statement/email`) use PDFKit to build a PDF in memory, then either stream it as a download or attach it to a Gmail OAuth2 email. The frontend adds two buttons to the existing DuesPage, gated on member email availability.

**Tech Stack:** PDFKit (new), Nodemailer (existing), Gmail OAuth2 (existing), React (existing), Sequelize (existing)

**Design doc:** `docs/plans/2026-03-13-year-end-contribution-statement-design.md`

---

## Task 1: Install PDFKit and copy church logo

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/assets/church-logo.png` (copy from frontend)

**Step 1: Install pdfkit**

```bash
cd backend && npm install pdfkit
```

Expected: `pdfkit` appears in `package.json` dependencies.

**Step 2: Create assets directory and copy logo**

```bash
mkdir -p backend/src/assets
cp frontend/public/cropped-AbuneAregawi-192x192.png backend/src/assets/church-logo.png
```

**Step 3: Verify**

```bash
ls backend/src/assets/church-logo.png && node -e "require('pdfkit'); console.log('pdfkit OK')" --prefix backend
```

Expected: file listed, "pdfkit OK" printed.

**Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/assets/church-logo.png
git commit -m "feat: install pdfkit and add church logo asset for contribution statement"
```

---

## Task 2: Create emailService.js

**Files:**
- Create: `backend/src/services/emailService.js`

**Step 1: Write the test**

Create `backend/src/__tests__/services/emailService.test.js`:

```javascript
'use strict';
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

describe('emailService', () => {
  let sendMailMock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
    process.env.GMAIL_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'test-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
  });

  afterEach(() => jest.resetModules());

  it('calls sendMail with correct fields', async () => {
    const { sendEmail } = require('../../services/emailService');
    await sendEmail({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Hello',
      attachments: [{ filename: 'test.pdf', content: Buffer.from('pdf') }]
    });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Hello',
      attachments: expect.arrayContaining([expect.objectContaining({ filename: 'test.pdf' })])
    }));
  });

  it('throws if Gmail env vars are missing', async () => {
    delete process.env.GMAIL_CLIENT_ID;
    const { sendEmail } = require('../../services/emailService');
    await expect(sendEmail({ to: 'x@x.com', subject: 's', text: 't' }))
      .rejects.toThrow('Missing Gmail OAuth');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- --testPathPattern="emailService" --no-coverage
```

Expected: FAIL — `emailService` module not found.

**Step 3: Implement emailService.js**

Create `backend/src/services/emailService.js`:

```javascript
'use strict';
const nodemailer = require('nodemailer');

function createTransporter() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error('Missing Gmail OAuth env vars (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: 'info@abunearegawi.church',
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
    },
  });
}

/**
 * Send an email with optional attachments.
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {Array}  [options.attachments]
 */
async function sendEmail({ to, subject, text, attachments = [] }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: '"Debre Tsehay Abune Aregawi Church" <info@abunearegawi.church>',
    to,
    subject,
    text,
    attachments,
  });
}

module.exports = { sendEmail };
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npm test -- --testPathPattern="emailService" --no-coverage
```

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add backend/src/services/emailService.js backend/src/__tests__/services/emailService.test.js
git commit -m "feat: add emailService wrapper for Gmail OAuth2 nodemailer"
```

---

## Task 3: Create statementController.js — PDF generation

**Files:**
- Create: `backend/src/controllers/statementController.js`
- Create: `backend/src/__tests__/controllers/statementController.test.js`

**Step 1: Write the tests**

Create `backend/src/__tests__/controllers/statementController.test.js`:

```javascript
'use strict';
jest.mock('pdfkit');
jest.mock('../models', () => ({
  Member: { findOne: jest.fn() },
  Transaction: { findAll: jest.fn() },
  IncomeCategory: {},
  sequelize: {
    where: jest.fn((a, b) => ({ _where: true })),
    fn: jest.fn((name, ...args) => ({ _fn: name, args })),
    col: jest.fn((name) => ({ _col: name })),
  },
}));
jest.mock('../services/emailService', () => ({ sendEmail: jest.fn() }));

const PDFDocument = require('pdfkit');
const { Member, Transaction } = require('../models');
const { sendEmail } = require('../services/emailService');

// Minimal PDFDoc mock
const mockDoc = {
  on: jest.fn((event, cb) => { if (event === 'end') setTimeout(cb, 0); }),
  image: jest.fn().mockReturnThis(),
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  fillColor: jest.fn().mockReturnThis(),
  switchToPage: jest.fn().mockReturnThis(),
  flushPages: jest.fn().mockReturnThis(),
  bufferedPageRange: jest.fn().mockReturnValue({ start: 0, count: 1 }),
  page: { height: 792, width: 612 },
  y: 200,
  end: jest.fn(),
};
PDFDocument.mockImplementation(() => mockDoc);

const mockMember = {
  id: 1,
  first_name: 'Dawit',
  last_name: 'Yifter',
  email: 'dawit@example.com',
  spouse_name: 'Sara',
  firebase_uid: 'uid-123',
};
const mockTransactions = [
  { payment_date: '2025-03-01', amount: '50.00', incomeCategory: { name: 'Membership Due' } },
  { payment_date: '2025-06-15', amount: '100.00', incomeCategory: { name: 'Tithe' } },
];

describe('statementController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Member.findOne.mockResolvedValue(mockMember);
    Transaction.findAll.mockResolvedValue(mockTransactions);
  });

  describe('downloadStatement', () => {
    it('returns 400 for invalid year', async () => {
      const { downloadStatement } = require('../../controllers/statementController');
      const req = { firebaseUid: 'uid-123', query: { year: 'abc' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await downloadStatement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when member not found', async () => {
      Member.findOne.mockResolvedValue(null);
      const { downloadStatement } = require('../../controllers/statementController');
      const req = { firebaseUid: 'uid-unknown', query: { year: '2025' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await downloadStatement(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('emailStatement', () => {
    it('returns 400 when member has no email', async () => {
      Member.findOne.mockResolvedValue({ ...mockMember, email: null });
      const { emailStatement } = require('../../controllers/statementController');
      const req = { firebaseUid: 'uid-123', body: { year: 2025 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await emailStatement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('email') }));
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --testPathPattern="statementController" --no-coverage
```

Expected: FAIL — `statementController` not found.

**Step 3: Implement statementController.js**

Create `backend/src/controllers/statementController.js`:

```javascript
'use strict';
const PDFDocument = require('pdfkit');
const path = require('path');
const { Op } = require('sequelize');
const { Member, Transaction, IncomeCategory, sequelize } = require('../models');
const { sendEmail } = require('../services/emailService');

const TAX_DEDUCTIBLE_GL_CODES = ['INC001', 'INC002', 'INC003', 'INC004', 'INC008'];
const LOGO_PATH = path.join(__dirname, '../assets/church-logo.png');

const currency = (n) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Fetch member + tax-deductible transactions for the given year.
 * Throws an error with a .status property on validation/not-found failures.
 */
async function fetchStatementData(firebaseUid, yearParam) {
  const parsedYear = parseInt(yearParam, 10);
  if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > new Date().getFullYear() + 1) {
    const err = new Error('Invalid year parameter');
    err.status = 400;
    throw err;
  }

  const member = await Member.findOne({ where: { firebase_uid: firebaseUid } });
  if (!member) {
    const err = new Error('Member not found');
    err.status = 404;
    throw err;
  }

  const transactions = await Transaction.findAll({
    where: {
      member_id: member.id,
      status: 'succeeded',
      [Op.and]: [
        sequelize.where(
          sequelize.fn('COALESCE',
            sequelize.col('for_year'),
            sequelize.fn('YEAR', sequelize.col('payment_date'))
          ),
          parsedYear
        )
      ]
    },
    include: [{
      model: IncomeCategory,
      as: 'incomeCategory',
      where: { gl_code: { [Op.in]: TAX_DEDUCTIBLE_GL_CODES } },
      required: true,
    }],
    order: [['payment_date', 'ASC']],
  });

  return { member, transactions, year: parsedYear };
}

/**
 * Build PDF buffer from member + transactions data.
 * Returns a Promise<Buffer>.
 */
function buildPdfBuffer({ member, transactions, year }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'LETTER', bufferPages: true });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const memberName = `${member.first_name} ${member.last_name}`;
    const greeting = member.spouse_name
      ? `Dear ${memberName} & ${member.spouse_name},`
      : `Dear ${memberName},`;
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // ── Header ────────────────────────────────────────────────
    try { doc.image(LOGO_PATH, 50, 45, { width: 55 }); } catch (_) { /* no logo - continue */ }

    doc.fontSize(13).font('Helvetica-Bold')
      .text('Debre Tsehay Abune Aregawi', 115, 48);
    doc.fontSize(11).font('Helvetica')
      .text('Orthodox Tewahedo Church', 115, 65);
    doc.fontSize(9)
      .text('1621 S Jupiter Rd, Garland, TX 75042', 115, 80)
      .text('info@abunearegawi.church', 115, 93);

    doc.moveTo(50, 118).lineTo(562, 118).lineWidth(1).stroke();

    // ── Date & Greeting ───────────────────────────────────────
    doc.fontSize(11).font('Helvetica').moveDown(2);
    doc.text(`Date: ${currentDate}`).moveDown(1);
    doc.text(greeting).moveDown(1);

    // ── Letter body ───────────────────────────────────────────
    const bodyOpts = { align: 'left', lineGap: 2 };
    doc.text(
      'We thank God for you! Your gifts to Debre Tsehay Abune Aregawi Orthodox Tewahedo Church ' +
      'throughout the year are gratefully acknowledged.',
      bodyOpts
    ).moveDown(0.8);

    doc.text(
      'Because of your contributions, our congregation has been able to continue the work of our ' +
      'Lord Jesus Christ in the community. Your generosity helps maintain our church building, support ' +
      'our ministries, and sustain the worship and sacramental services of our parish.',
      bodyOpts
    ).moveDown(0.8);

    doc.text(
      `Below is an itemized statement of your contributions for the year ${year} according to our records. ` +
      'If you have any concerns regarding the accuracy of this information, please contact us.',
      bodyOpts
    ).moveDown(0.8);

    doc.text(
      'For income tax purposes, please note that you did not receive any goods or services in return ' +
      'for these contributions other than intangible religious benefits.',
      bodyOpts
    ).moveDown(1.5);

    // ── Itemized table ────────────────────────────────────────
    const COL_DATE = 50;
    const COL_CAT  = 175;
    const COL_AMT  = 462;
    const ROW_H    = 18;
    const PAGE_BOTTOM = doc.page.height - 80; // leave room for footer

    // Table header
    let rowY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Date',     COL_DATE, rowY);
    doc.text('Category', COL_CAT,  rowY);
    doc.text('Amount',   COL_AMT,  rowY, { width: 100, align: 'right' });
    rowY += ROW_H - 2;
    doc.moveTo(50, rowY).lineTo(562, rowY).lineWidth(0.5).stroke();
    rowY += 6;

    // Table rows
    doc.font('Helvetica').fontSize(10);
    transactions.forEach((t) => {
      if (rowY > PAGE_BOTTOM) {
        doc.addPage();
        rowY = 60;
      }
      const dateStr = new Date(t.payment_date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
      doc.text(dateStr,                  COL_DATE, rowY);
      doc.text(t.incomeCategory.name,    COL_CAT,  rowY);
      doc.text(currency(t.amount),       COL_AMT,  rowY, { width: 100, align: 'right' });
      rowY += ROW_H;
    });

    // Total row
    doc.moveTo(50, rowY).lineTo(562, rowY).lineWidth(0.5).stroke();
    rowY += 6;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Total Contributions for ${year}:`, COL_DATE, rowY);
    doc.text(currency(total), COL_AMT, rowY, { width: 100, align: 'right' });

    // ── Closing ───────────────────────────────────────────────
    doc.font('Helvetica').fontSize(11).moveDown(3);
    doc.text(
      'Thank you again for your generous commitment to the work of Jesus Christ through this church.'
    ).moveDown(0.8);
    doc.text('God bless you.').moveDown(1.5);
    doc.text('Sincerely,').moveDown(0.5);
    doc.font('Helvetica-Bold')
      .text('Debre Tsehay Abune Aregawi Orthodox Tewahedo Church');

    // ── Footer on every page ──────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').fillColor('#888888').text(
        `Page ${i - range.start + 1} of ${range.count}  ·  Confidential`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
    }

    doc.flushPages();
    doc.end();
  });
}

// ── Route handlers ────────────────────────────────────────────

/**
 * GET /api/members/statement/pdf?year=YYYY
 * Streams PDF as a file download.
 */
const downloadStatement = async (req, res) => {
  try {
    const { year } = req.query;
    const data = await fetchStatementData(req.firebaseUid, year);
    const pdfBuffer = await buildPdfBuffer(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Annual_Contribution_Statement_${data.year}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    const status = err.status || 500;
    console.error('Error generating statement PDF:', err);
    res.status(status).json({ message: err.message || 'Failed to generate statement' });
  }
};

/**
 * POST /api/members/statement/email
 * Body: { year: number }
 * Generates PDF and sends it to the member's email.
 */
const emailStatement = async (req, res) => {
  try {
    const { year } = req.body;
    const data = await fetchStatementData(req.firebaseUid, year);

    if (!data.member.email) {
      return res.status(400).json({ message: 'No email address on file for this member' });
    }

    const pdfBuffer = await buildPdfBuffer(data);
    const memberName = `${data.member.first_name} ${data.member.last_name}`;

    await sendEmail({
      to: data.member.email,
      subject: `Your Annual Contribution Statement for ${data.year}`,
      text:
        `Dear ${memberName},\n\n` +
        'Peace and blessings to you.\n\n' +
        `Please find attached your Annual Contribution Statement for the year ${data.year} from ` +
        'Debre Tsehay Abune Aregawi Orthodox Tewahedo Church.\n\n' +
        'We are grateful for your generosity and continued support of the Church. Your contributions ' +
        'help sustain the ministry of our Lord Jesus Christ and support the spiritual and community ' +
        'work of our parish.\n\n' +
        'If you have any questions regarding this statement, please feel free to contact the church administration.\n\n' +
        'May God bless you and your family.\n\n' +
        'Sincerely,\n' +
        'Debre Tsehay Abune Aregawi Orthodox Tewahedo Church',
      attachments: [{
        filename: `Annual_Contribution_Statement_${data.year}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    res.json({ message: `Statement sent to ${data.member.email}` });
  } catch (err) {
    const status = err.status || 502;
    console.error('Error emailing statement:', err);
    res.status(status).json({ message: err.message || 'Failed to send statement email' });
  }
};

module.exports = { downloadStatement, emailStatement };
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --testPathPattern="statementController" --no-coverage
```

Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add backend/src/controllers/statementController.js \
        backend/src/__tests__/controllers/statementController.test.js
git commit -m "feat: add statementController with PDFKit generation and email delivery"
```

---

## Task 4: Create routes and register in server.js

**Files:**
- Create: `backend/src/routes/statementRoutes.js`
- Modify: `backend/src/server.js`

**Step 1: Create statementRoutes.js**

Create `backend/src/routes/statementRoutes.js`:

```javascript
'use strict';
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { downloadStatement, emailStatement } = require('../controllers/statementController');

// Inline Firebase-token-only middleware (same pattern as memberRoutes.js)
const verifyFirebaseTokenOnly = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No Firebase token provided.' });
    }
    const token = authHeader.substring(7);
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUid = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
  }
};

// GET /api/members/statement/pdf?year=YYYY
router.get('/pdf', verifyFirebaseTokenOnly, downloadStatement);

// POST /api/members/statement/email   body: { year }
router.post('/email', verifyFirebaseTokenOnly, emailStatement);

module.exports = router;
```

**Step 2: Register route in server.js**

In `backend/src/server.js`, add after the existing route imports (around line 52):

```javascript
const statementRoutes = require('./routes/statementRoutes');
```

Then add after the existing `app.use('/api/members', memberRoutes)` line (around line 247):

```javascript
app.use('/api/members/statement', statementRoutes);
```

**Step 3: Verify server starts**

```bash
cd backend && node -e "require('./src/server.js')" 2>&1 | head -5
```

Expected: No crash / module not found errors.

**Step 4: Commit**

```bash
git add backend/src/routes/statementRoutes.js backend/src/server.js
git commit -m "feat: register statement routes at /api/members/statement"
```

---

## Task 5: Update DuesPage.tsx — add statement buttons

**Files:**
- Modify: `frontend/src/components/DuesPage.tsx`

**Step 1: Add state and handler logic**

After the existing `const [dues, setDues]` line (around line 53), add:

```typescript
const [statementLoading, setStatementLoading] = useState<'pdf' | 'email' | null>(null);
const [statementMsg, setStatementMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
```

After the existing `fetchDues` function, add the two handlers:

```typescript
const handleDownloadStatement = async () => {
  if (!firebaseUser) return;
  setStatementLoading('pdf');
  setStatementMsg(null);
  try {
    const token = await firebaseUser.getIdToken();
    const res = await fetch(
      `${apiUrl}/api/members/statement/pdf?year=${selectedYear}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || 'Failed to generate statement');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Annual_Contribution_Statement_${selectedYear}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    setStatementMsg({ type: 'error', text: e.message || 'Failed to generate statement' });
  } finally {
    setStatementLoading(null);
  }
};

const handleEmailStatement = async () => {
  if (!firebaseUser) return;
  setStatementLoading('email');
  setStatementMsg(null);
  try {
    const token = await firebaseUser.getIdToken();
    const res = await fetch(`${apiUrl}/api/members/statement/email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ year: selectedYear }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Failed to send email');
    setStatementMsg({ type: 'success', text: json.message });
  } catch (e: any) {
    setStatementMsg({ type: 'error', text: e.message || 'Failed to send email' });
  } finally {
    setStatementLoading(null);
  }
};
```

**Step 2: Add buttons to the JSX**

After the closing `</div>` of the payment history section (after line 270, just before the outer `</div></div></div>`), add:

```tsx
{/* Annual Contribution Statement */}
<div className="mt-8 pt-6 border-t border-gray-200">
  <h3 className="text-lg font-semibold text-gray-900 mb-1">
    Annual Contribution Statement
  </h3>
  <p className="text-sm text-gray-500 mb-4">
    Generate your tax-deductible contribution statement for {selectedYear}.
  </p>

  <div className="flex flex-wrap gap-3">
    <button
      onClick={handleDownloadStatement}
      disabled={statementLoading !== null}
      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {statementLoading === 'pdf' ? (
        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      Print Statement
    </button>

    {member.email && (
      <button
        onClick={handleEmailStatement}
        disabled={statementLoading !== null}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {statementLoading === 'email' ? (
          <span className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
        Email Statement
      </button>
    )}
  </div>

  {statementMsg && (
    <p className={`mt-3 text-sm ${statementMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
      {statementMsg.text}
    </p>
  )}
</div>
```

**Step 3: Verify the app compiles**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully` or only warnings (no errors).

**Step 4: Commit**

```bash
git add frontend/src/components/DuesPage.tsx
git commit -m "feat: add Print Statement and Email Statement buttons to DuesPage"
```

---

## Task 6: Manual smoke test

**Step 1: Start backend**

```bash
cd backend && npm start
```

**Step 2: Start frontend**

```bash
cd frontend && npm start
```

**Step 3: Test Print Statement**
1. Log in as a member with contributions in 2025
2. Navigate to `/dues`, select year 2025
3. Click "Print Statement"
4. Verify: PDF downloads, contains correct member name, itemized transactions with only tax-deductible categories (no INC005/INC007 rows), correct total, church header/footer

**Step 4: Test Email Statement**
1. With same member (must have email on file), click "Email Statement"
2. Verify: Success message appears, email arrives with PDF attachment

**Step 5: Test member without email**
1. Log in as a member with no email on file
2. Navigate to `/dues`
3. Verify: Only "Print Statement" button is visible — "Email Statement" is hidden

**Step 6: Commit and push**

```bash
git push origin main
```
