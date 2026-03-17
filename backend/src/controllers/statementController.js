'use strict';
const PDFDocument = require('pdfkit');
const path = require('path');
const { Op } = require('sequelize');
const { Member, Transaction, IncomeCategory, sequelize } = require('../models');
const { sendEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLogger');

const TAX_DEDUCTIBLE_GL_CODES = ['INC001', 'INC002', 'INC003', 'INC004', 'INC008'];
// Payment types that are inherently tax-deductible (used as fallback when income_category_id is null)
const TAX_DEDUCTIBLE_PAYMENT_TYPES = ['membership_due', 'offering', 'tithe', 'event', 'donation', 'vow'];
const LOGO_PATH = path.join(__dirname, '../assets/church-logo.png');

const currency = (n) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// Resolves head-of-household and all family member IDs for any given member.
// Returns { headOfHousehold: Member, familyMemberIds: number[] }
async function resolveHousehold(member) {
  const effectiveFamilyId = member.family_id || member.id;
  const familyMembers = await Member.findAll({
    where: {
      [Op.or]: [
        { family_id: effectiveFamilyId },
        { id: effectiveFamilyId },
      ],
    },
  });

  const headOfHousehold = familyMembers.find(
    (m) => !m.family_id || String(m.family_id) === String(m.id) || String(m.id) === String(effectiveFamilyId)
  ) || member;

  const familyMemberIds = familyMembers.map((m) => m.id);
  return { headOfHousehold, familyMemberIds };
}

async function fetchTaxDeductibleTransactions(memberIds, parsedYear) {
  return Transaction.findAll({
    where: {
      member_id: { [Op.in]: memberIds },
      status: 'succeeded',
      [Op.and]: [
        sequelize.where(
          sequelize.fn('COALESCE',
            sequelize.col('for_year'),
            sequelize.fn('date_part', sequelize.literal("'year'"), sequelize.col('payment_date'))
          ),
          parsedYear
        )
      ],
      [Op.or]: [
        // Transactions with a linked income category whose GL code is tax-deductible
        { '$incomeCategory.gl_code$': { [Op.in]: TAX_DEDUCTIBLE_GL_CODES } },
        // Transactions with no income_category_id but whose payment_type is inherently deductible
        // (covers legacy imported transactions that predate income_category_id population)
        { income_category_id: null, payment_type: { [Op.in]: TAX_DEDUCTIBLE_PAYMENT_TYPES } },
      ],
    },
    include: [{
      model: IncomeCategory,
      as: 'incomeCategory',
      required: false, // LEFT JOIN — transactions with null income_category_id are kept
    }],
    order: [['payment_date', 'ASC']],
  });
}

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

  const { headOfHousehold, familyMemberIds } = await resolveHousehold(member);
  const transactions = await fetchTaxDeductibleTransactions(familyMemberIds, parsedYear);
  return { member: headOfHousehold, transactions, year: parsedYear };
}

function buildPdfBuffer({ member, transactions, year }) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const MARGIN       = 50;
    const PAGE_W       = 612;
    const PAGE_H       = 792;
    const CONTENT_W    = PAGE_W - MARGIN * 2;   // 512
    const FOOTER_Y     = PAGE_H - 38;
    const PAGE_BOTTOM  = PAGE_H - 70;           // trigger new page before here

    const doc = new PDFDocument({ margin: MARGIN, size: 'LETTER' });
    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const total      = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const memberName = `${member.first_name} ${member.last_name}`;
    const churchEIN  = process.env.CHURCH_EIN || '—';

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Build member address (single line when possible)
    const cityLine = [member.city, member.state, member.postal_code].filter(Boolean).join(', ');
    const addrLine1 = member.street_line1 || '';
    const memberAddress = [addrLine1, cityLine].filter(Boolean).join(', ');

    const formatMethod = (m) =>
      m ? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

    // Footer temporarily hidden — re-enable once multi-page layout is finalized
    const drawFooter = () => {};

    let y = MARGIN;

    // ── Church Letterhead ─────────────────────────────────────
    try { doc.image(LOGO_PATH, MARGIN, y, { width: 58 }); } catch (_) {}

    const hx = MARGIN + 68;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
      .text('DEBRE TSEHAY ABUNE AREGAWI', hx, y, { width: CONTENT_W - 68 });
    y += 17;
    doc.fontSize(11)
      .text('ORTHODOX TEWAHEDO CHURCH', hx, y, { width: CONTENT_W - 68 });
    y += 15;
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
      .text('1621 S Jupiter Rd, Garland, TX 75042', hx, y, { width: CONTENT_W - 68 });
    y += 13;
    doc.text('Phone: (469) 436-3356  |  Email: abunearegawitx@gmail.com', hx, y, { width: CONTENT_W - 68 });
    y += 20;

    // Separator
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(1.5).strokeColor('#333333').stroke();
    y += 10;

    // EIN
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(`Tax ID (EIN): ${churchEIN}`, MARGIN, y);
    y = doc.y + 14;

    // ── Date & Member Info ────────────────────────────────────
    doc.font('Helvetica').fontSize(10).fillColor('#000000')
      .text(`Date: ${currentDate}`, MARGIN, y);
    y = doc.y + 6;

    doc.text(`Member Name: ${memberName}`, MARGIN, y);
    y = doc.y + 4;

    if (memberAddress) {
      doc.text(`Member Address: ${memberAddress}`, MARGIN, y);
      y = doc.y + 4;
    }
    y += 10;

    // Subject
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
      .text(`Subject: Annual Contribution Statement for Tax Year ${year}`, MARGIN, y, { width: CONTENT_W });
    y = doc.y + 16;

    // ── Salutation ────────────────────────────────────────────
    const salutation = member.spouse_name
      ? `Dear ${memberName} and ${member.spouse_name},`
      : `Dear ${memberName},`;
    doc.font('Helvetica').fontSize(10)
      .text(salutation, MARGIN, y);
    y = doc.y + 12;

    // ── Body ──────────────────────────────────────────────────
    doc.text('Peace and blessings to you.', MARGIN, y, { width: CONTENT_W });
    y = doc.y + 10;

    doc.text(
      'Thank you for your faithful support of Debre Tsehay Abune Aregawi Orthodox Tewahedo Church. ' +
      'Your generosity enables our parish to continue its worship services, ministries, and outreach ' +
      'within the community in the name of our Lord Jesus Christ.',
      MARGIN, y, { width: CONTENT_W }
    );
    y = doc.y + 10;

    doc.text(
      `According to our records, the following is a summary of your charitable contributions for the tax year ${year}.`,
      MARGIN, y, { width: CONTENT_W }
    );
    y = doc.y + 16;

    // ── Contribution Summary heading ──────────────────────────
    doc.font('Helvetica-Bold').fontSize(11)
      .text('Contribution Summary', MARGIN, y);
    y = doc.y + 10;

    // ── Table ─────────────────────────────────────────────────
    const COL_DATE   = MARGIN;
    const COL_DESC   = MARGIN + 88;
    const COL_METHOD = MARGIN + 268;
    const COL_AMT    = PAGE_W - MARGIN - 78;
    const ROW_H      = 16;
    const TABLE_R    = PAGE_W - MARGIN;

    // Header row
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
    doc.text('Date',        COL_DATE,   y, { width: 84 });
    doc.text('Description', COL_DESC,   y, { width: 176 });
    doc.text('Method',      COL_METHOD, y, { width: 105 });
    doc.text('Amount',      COL_AMT,    y, { width: 78, align: 'right' });
    y += ROW_H - 2;
    doc.moveTo(MARGIN, y).lineTo(TABLE_R, y).lineWidth(0.5).strokeColor('#000000').stroke();
    y += 5;

    // Data rows
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    transactions.forEach((t) => {
      if (y > PAGE_BOTTOM) {
        drawFooter();
        doc.addPage();
        y = MARGIN;
      }
      const dateStr = new Date(t.payment_date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
      const categoryName = t.incomeCategory?.name || formatMethod(t.payment_type);
      doc.text(dateStr,        COL_DATE,   y, { width: 84 });
      doc.text(categoryName,   COL_DESC,   y, { width: 176 });
      doc.text(formatMethod(t.payment_method),  COL_METHOD, y, { width: 105 });
      doc.text(currency(t.amount),              COL_AMT,    y, { width: 78, align: 'right' });
      y += ROW_H;
    });

    // Total row
    doc.moveTo(MARGIN, y).lineTo(TABLE_R, y).lineWidth(0.5).stroke();
    y += 6;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
      .text(`Total Contributions for ${year}:`, COL_DATE, y, { width: 320 });
    doc.text(currency(total), COL_AMT, y, { width: 78, align: 'right' });
    y += 24;

    // Only break to a new page if the closing block (~200px) truly won't fit
    if (y + 200 > PAGE_H) {
      drawFooter();
      doc.addPage();
      y = MARGIN;
    }

    // ── Disclaimers ───────────────────────────────────────────
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(
        'For federal income tax purposes, please note that no goods or services were provided in ' +
        'exchange for these contributions other than intangible religious benefits.',
        MARGIN, y, { width: CONTENT_W }
      );
    y = doc.y + 8;

    doc.text(
      'Please retain this statement for your tax records. If you believe any information on this ' +
      'statement is inaccurate or if you have any questions, please contact the church office.',
      MARGIN, y, { width: CONTENT_W }
    );
    y = doc.y + 16;

    // ── Closing ───────────────────────────────────────────────
    doc.font('Helvetica').fontSize(10).fillColor('#000000')
      .text(
        'Thank you again for your generosity and commitment to the work of Christ through His Church.',
        MARGIN, y, { width: CONTENT_W }
      );
    y = doc.y + 10;
    doc.text('May God bless you and your family abundantly.', MARGIN, y, { width: CONTENT_W });
    y = doc.y + 28;
    doc.text('Sincerely,', MARGIN, y);
    y = doc.y + 30;
    doc.font('Helvetica-Bold').fontSize(10)
      .text('Debre Tsehay Abune Aregawi Orthodox Tewahedo Church', MARGIN, y, { width: CONTENT_W });

    // Only draw footer if content doesn't crowd it (avoids overlap on tight pages)
    if (doc.y < FOOTER_Y - 5) {
      drawFooter();
    }
    doc.end();
  });
}

async function fetchStatementDataById(memberIdParam, yearParam) {
  const parsedYear = parseInt(yearParam, 10);
  if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > new Date().getFullYear() + 1) {
    const err = new Error('Invalid year parameter');
    err.status = 400;
    throw err;
  }

  const memberId = parseInt(memberIdParam, 10);
  if (isNaN(memberId)) {
    const err = new Error('Invalid member ID');
    err.status = 400;
    throw err;
  }

  const member = await Member.findByPk(memberId);
  if (!member) {
    const err = new Error('Member not found');
    err.status = 404;
    throw err;
  }

  const { headOfHousehold, familyMemberIds } = await resolveHousehold(member);
  const transactions = await fetchTaxDeductibleTransactions(familyMemberIds, parsedYear);
  return { member: headOfHousehold, transactions, year: parsedYear };
}

const downloadStatementForMember = async (req, res) => {
  try {
    const { memberId, year } = req.query;
    const data = await fetchStatementDataById(memberId, year);
    const pdfBuffer = await buildPdfBuffer(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Annual_Contribution_Statement_${data.year}_${data.member.last_name}.pdf"`
    );
    res.send(pdfBuffer);

    logActivity({
      userId: req.user.id,
      action: 'ADMIN_DOWNLOAD_STATEMENT',
      entityType: 'ContributionStatement',
      entityId: String(data.member.id),
      details: {
        year: data.year,
        memberName: `${data.member.first_name} ${data.member.last_name}`,
        memberId: data.member.id,
      },
      req,
    });
  } catch (err) {
    const status = err.status || 500;
    console.error('Error generating statement PDF for member:', err);
    res.status(status).json({ message: err.message || 'Failed to generate statement' });
  }
};

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

    logActivity({
      userId: data.member.id,
      action: 'DOWNLOAD_STATEMENT',
      entityType: 'ContributionStatement',
      entityId: String(data.member.id),
      details: { year: data.year, memberName: `${data.member.first_name} ${data.member.last_name}` },
      req,
    });
  } catch (err) {
    const status = err.status || 500;
    console.error('Error generating statement PDF:', err);
    res.status(status).json({ message: err.message || 'Failed to generate statement' });
  }
};

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

module.exports = { downloadStatement, emailStatement, downloadStatementForMember };
