'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const { Op } = require('sequelize');
const { MemberLoan, Member, Transaction, LedgerEntry, sequelize } = require('../models');
const { logActivity } = require('../utils/activityLogger');

const LOGO_PATH = path.join(__dirname, '../assets/church-logo.png');
const VALID_PAYMENT_METHODS = ['cash', 'check', 'zelle', 'other'];

// POST /api/loans
const createLoan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      member_id,
      amount,
      payment_method,
      receipt_number,
      loan_date,
      notes
    } = req.body;

    // Validate required fields
    if (!member_id || !amount || !payment_method || !loan_date) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Missing required fields: member_id, amount, payment_method, loan_date' });
    }

    // Validate member exists
    const member = await Member.findByPk(member_id);
    if (!member) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Validate amount
    const loanAmount = parseFloat(amount);
    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    // Validate payment method
    if (!VALID_PAYMENT_METHODS.includes(payment_method.toLowerCase())) {
      await t.rollback();
      return res.status(400).json({ success: false, message: `Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` });
    }

    // Receipt number required for cash/check
    if (['cash', 'check'].includes(payment_method.toLowerCase()) && !receipt_number) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Receipt number is required for cash and check payments' });
    }

    // Check receipt uniqueness
    if (receipt_number && receipt_number !== '000') {
      const existing = await Transaction.findOne({ where: { receipt_number } });
      if (existing) {
        await t.rollback();
        return res.status(409).json({ success: false, message: `Receipt number "${receipt_number}" has already been used. Please use a unique receipt number.` });
      }
    }

    const collected_by = req.user?.id;
    if (!collected_by) {
      await t.rollback();
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Create transaction
    const transaction = await Transaction.create({
      member_id,
      collected_by,
      payment_date: loan_date,
      amount: loanAmount,
      payment_type: 'loan_received',
      payment_method: payment_method.toLowerCase(),
      status: 'succeeded',
      receipt_number: receipt_number || null,
      note: notes || null
    }, { transaction: t });

    // Create ledger entry
    await LedgerEntry.create({
      type: 'loan_received',
      category: 'LIA001',
      amount: loanAmount,
      entry_date: loan_date,
      payment_method: payment_method.toLowerCase(),
      receipt_number: receipt_number || null,
      memo: `Loan received from ${member.first_name} ${member.last_name}`,
      collected_by,
      member_id,
      transaction_id: transaction.id,
      source_system: 'manual'
    }, { transaction: t });

    // Create loan record
    const loan = await MemberLoan.create({
      member_id,
      transaction_id: transaction.id,
      amount: loanAmount,
      outstanding_balance: loanAmount,
      payment_method: payment_method.toLowerCase(),
      receipt_number: receipt_number || null,
      loan_date,
      status: 'ACTIVE',
      notes: notes || null,
      collected_by
    }, { transaction: t });

    await t.commit();

    logActivity({
      userId: collected_by,
      action: 'CREATE_LOAN',
      entityType: 'MemberLoan',
      entityId: String(loan.id),
      details: { amount: loanAmount, memberId: member_id, loanId: loan.id },
      req
    });

    const loanWithMember = await MemberLoan.findByPk(loan.id, {
      include: [
        { model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });

    res.status(201).json({ success: true, data: { loan: loanWithMember, transaction } });
  } catch (error) {
    await t.rollback();
    console.error('Error creating loan:', error);
    res.status(500).json({ success: false, message: 'Failed to create loan', error: error.message });
  }
};

// POST /api/loans/:id/repayments
const recordRepayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { repayment_amount, payment_method, receipt_number, repayment_date, notes } = req.body;

    const loan = await MemberLoan.findByPk(id, { transaction: t });
    if (!loan) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    if (loan.status === 'CLOSED') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Cannot record repayment on a closed loan' });
    }

    const repayAmount = parseFloat(repayment_amount);
    if (!Number.isFinite(repayAmount) || repayAmount <= 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Repayment amount must be a positive number' });
    }

    const outstanding = parseFloat(loan.outstanding_balance);
    if (repayAmount > outstanding) {
      await t.rollback();
      return res.status(400).json({ success: false, message: `Repayment amount ($${repayAmount}) exceeds outstanding balance ($${outstanding})` });
    }

    if (!payment_method || !VALID_PAYMENT_METHODS.includes(payment_method.toLowerCase())) {
      await t.rollback();
      return res.status(400).json({ success: false, message: `Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` });
    }

    if (['cash', 'check'].includes(payment_method.toLowerCase()) && !receipt_number) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Receipt number is required for cash and check payments' });
    }

    // Check receipt uniqueness
    if (receipt_number && receipt_number !== '000') {
      const existing = await Transaction.findOne({ where: { receipt_number } });
      if (existing) {
        await t.rollback();
        return res.status(409).json({ success: false, message: `Receipt number "${receipt_number}" has already been used.` });
      }
    }

    const collected_by = req.user?.id;
    if (!collected_by) {
      await t.rollback();
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    const payDate = repayment_date || new Date().toISOString().split('T')[0];

    // Create repayment transaction
    const transaction = await Transaction.create({
      member_id: loan.member_id,
      collected_by,
      payment_date: payDate,
      amount: repayAmount,
      payment_type: 'loan_repayment',
      payment_method: payment_method.toLowerCase(),
      status: 'succeeded',
      receipt_number: receipt_number || null,
      note: notes || null
    }, { transaction: t });

    // Create ledger entry
    await LedgerEntry.create({
      type: 'loan_repayment',
      category: 'LIA002',
      amount: repayAmount,
      entry_date: payDate,
      payment_method: payment_method.toLowerCase(),
      receipt_number: receipt_number || null,
      memo: `Loan repayment for loan #${loan.id}`,
      collected_by,
      member_id: loan.member_id,
      transaction_id: transaction.id,
      source_system: 'manual'
    }, { transaction: t });

    // Update loan balance and status
    const newBalance = parseFloat((outstanding - repayAmount).toFixed(2));
    const newStatus = newBalance === 0 ? 'CLOSED' : 'PARTIALLY_REPAID';

    await loan.update({
      outstanding_balance: newBalance,
      status: newStatus
    }, { transaction: t });

    await t.commit();

    logActivity({
      userId: collected_by,
      action: 'LOAN_REPAYMENT',
      entityType: 'MemberLoan',
      entityId: String(loan.id),
      details: { repayment_amount: repayAmount, new_balance: newBalance, new_status: newStatus },
      req
    });

    const updatedLoan = await MemberLoan.findByPk(loan.id, {
      include: [
        { model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });

    res.json({ success: true, data: { loan: updatedLoan, transaction } });
  } catch (error) {
    await t.rollback();
    console.error('Error recording repayment:', error);
    res.status(500).json({ success: false, message: 'Failed to record repayment', error: error.message });
  }
};

// GET /api/loans
const getLoans = async (req, res) => {
  try {
    const { page = 0, size = 20, status, member_id, start_date, end_date } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (member_id) whereClause.member_id = member_id;
    if (start_date || end_date) {
      whereClause.loan_date = {};
      if (start_date) whereClause.loan_date[Op.gte] = start_date;
      if (end_date) whereClause.loan_date[Op.lte] = end_date;
    }

    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(size, 10);
    const offset = pageNum * pageSize;

    const { count, rows } = await MemberLoan.findAndCountAll({
      where: whereClause,
      include: [
        { model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] },
        { model: Member, as: 'collector', attributes: ['id', 'first_name', 'last_name'] }
      ],
      limit: pageSize,
      offset,
      order: [['loan_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        loans: rows,
        pagination: {
          current_page: pageNum,
          total_pages: Math.ceil(count / pageSize),
          total_items: count
        }
      }
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loans', error: error.message });
  }
};

// GET /api/loans/:id
const getLoanById = async (req, res) => {
  try {
    const loan = await MemberLoan.findByPk(req.params.id, {
      include: [
        { model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] },
        { model: Member, as: 'collector', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    res.json({ success: true, data: loan });
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan', error: error.message });
  }
};

// GET /api/loans/stats
const getLoanStats = async (req, res) => {
  try {
    const [
      totalOutstandingBalance,
      activeLoansCount,
      partiallyRepaidCount,
      closedLoansCount,
      totalLoanedAmount,
      lendingMembersCount
    ] = await Promise.all([
      MemberLoan.sum('outstanding_balance', { where: { status: { [Op.in]: ['ACTIVE', 'PARTIALLY_REPAID'] } } }),
      MemberLoan.count({ where: { status: 'ACTIVE' } }),
      MemberLoan.count({ where: { status: 'PARTIALLY_REPAID' } }),
      MemberLoan.count({ where: { status: 'CLOSED' } }),
      MemberLoan.sum('amount'),
      MemberLoan.count({
        where: { status: { [Op.in]: ['ACTIVE', 'PARTIALLY_REPAID'] } },
        distinct: true,
        col: 'member_id'
      })
    ]);

    const outstanding = parseFloat(totalOutstandingBalance) || 0;
    const total = parseFloat(totalLoanedAmount) || 0;
    const totalRepaidAmount = parseFloat((total - outstanding).toFixed(2));

    const recentLoans = await MemberLoan.findAll({
      include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    const recentRepayments = await Transaction.findAll({
      where: { payment_type: 'loan_repayment' },
      include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['payment_date', 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        totalOutstandingBalance: outstanding,
        activeLoansCount,
        partiallyRepaidCount,
        closedLoansCount,
        totalLoanedAmount: total,
        totalRepaidAmount,
        lendingMembersCount,
        recentLoans,
        recentRepayments
      }
    });
  } catch (error) {
    console.error('Error fetching loan stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan statistics', error: error.message });
  }
};

// GET /api/loans/:id/receipt
const getLoanReceipt = async (req, res) => {
  try {
    const loan = await MemberLoan.findByPk(req.params.id, {
      include: [
        { model: Member, as: 'member' }
      ]
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const pdfBuffer = await buildLoanReceiptPdf(loan);

    const memberName = `${loan.member.first_name}_${loan.member.last_name}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Loan_Receipt_${loan.id}_${memberName}.pdf"`);
    res.send(pdfBuffer);

    logActivity({
      userId: req.user?.id,
      action: 'DOWNLOAD_LOAN_RECEIPT',
      entityType: 'MemberLoan',
      entityId: String(loan.id),
      details: { memberId: loan.member_id, amount: loan.amount },
      req
    });
  } catch (error) {
    console.error('Error generating loan receipt:', error);
    res.status(500).json({ success: false, message: 'Failed to generate receipt', error: error.message });
  }
};

function buildLoanReceiptPdf(loan) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const MARGIN = 50;
    const PAGE_W = 612;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const doc = new PDFDocument({ margin: MARGIN, size: 'LETTER' });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const memberName = `${loan.member.first_name} ${loan.member.last_name}`;
    const loanDateStr = new Date(loan.loan_date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const currency = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formatMethod = (m) => m ? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

    let y = MARGIN;

    // Church Letterhead
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
    y += 16;

    // Title — prominent warning
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#CC0000')
      .text('LOAN RECEIPT — NOT A DONATION', MARGIN, y, { align: 'center', width: CONTENT_W });
    y = doc.y + 6;
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(1).strokeColor('#CC0000').stroke();
    y += 16;

    // Date and Receipt Info
    doc.font('Helvetica').fontSize(10).fillColor('#000000')
      .text(`Date Issued: ${currentDate}`, MARGIN, y);
    y = doc.y + 4;
    doc.text(`Loan Receipt #: ${loan.id}`, MARGIN, y);
    y = doc.y + 16;

    // Loan Details
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
      .text('Loan Details', MARGIN, y);
    y = doc.y + 10;

    const details = [
      ['Member Name', memberName],
      ['Loan Date', loanDateStr],
      ['Loan Amount', currency(loan.amount)],
      ['Outstanding Balance', currency(loan.outstanding_balance)],
      ['Payment Method', formatMethod(loan.payment_method)],
    ];

    if (loan.receipt_number) {
      details.push(['Receipt / Check Number', loan.receipt_number]);
    }
    if (loan.status) {
      details.push(['Loan Status', loan.status]);
    }
    if (loan.notes) {
      details.push(['Notes', loan.notes]);
    }

    doc.font('Helvetica').fontSize(10).fillColor('#000000');
    for (const [label, value] of details) {
      doc.text(`${label}:`, MARGIN, y, { width: 180, continued: false });
      doc.text(value, MARGIN + 190, y - doc.currentLineHeight(), { width: CONTENT_W - 190 });
      y = doc.y + 4;
    }
    y += 16;

    // Disclaimer box
    doc.rect(MARGIN, y, CONTENT_W, 80).fillAndStroke('#FFF3CD', '#CC8800');
    y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#856404')
      .text('IMPORTANT NOTICE', MARGIN + 10, y, { width: CONTENT_W - 20 });
    y = doc.y + 6;
    doc.font('Helvetica').fontSize(9).fillColor('#856404')
      .text(
        'This payment constitutes a loan to Debre Tsehay Abune Aregawi Orthodox Tewahedo Church ' +
        'and will be repaid in full. It is NOT a charitable donation and is NOT tax-deductible. ' +
        'Please retain this receipt as proof of your loan.',
        MARGIN + 10, y, { width: CONTENT_W - 20 }
      );
    y = doc.y + 20;

    // Signature lines
    doc.font('Helvetica').fontSize(10).fillColor('#000000')
      .text('Acknowledged by:', MARGIN, y);
    y = doc.y + 30;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 200, y).lineWidth(0.5).strokeColor('#333333').stroke();
    doc.moveTo(MARGIN + 240, y).lineTo(MARGIN + 460, y).lineWidth(0.5).strokeColor('#333333').stroke();
    y += 5;
    doc.fontSize(8).fillColor('#555555')
      .text('Church Treasurer Signature', MARGIN, y, { width: 200 })
      .text('Date', MARGIN + 240, y, { width: 220 });

    doc.end();
  });
}

module.exports = { createLoan, recordRepayment, getLoans, getLoanById, getLoanStats, getLoanReceipt };
