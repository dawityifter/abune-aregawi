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
            sequelize.fn('date_part', sequelize.literal("'year'"), sequelize.col('payment_date'))
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
    const PAGE_BOTTOM = doc.page.height - 80;

    let rowY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Date',     COL_DATE, rowY);
    doc.text('Category', COL_CAT,  rowY);
    doc.text('Amount',   COL_AMT,  rowY, { width: 100, align: 'right' });
    rowY += ROW_H - 2;
    doc.moveTo(50, rowY).lineTo(562, rowY).lineWidth(0.5).stroke();
    rowY += 6;

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
