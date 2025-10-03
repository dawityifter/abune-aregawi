const { MemberPayment, Member, Transaction, Dependent, LedgerEntry } = require('../models');
const { Op, literal } = require('sequelize');

// Get all member payments with pagination and filtering
const getAllMemberPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // Search functionality (now uses memberName and memberId)
    if (search) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { memberName: { [Op.iLike]: `%${search}%` } },
          literal(`CAST("member_id" AS TEXT) ILIKE '%${search}%'`)
        ]
      };
    }

    // Status filtering (now uses balanceDue)
    if (status) {
      switch (status) {
        case 'up_to_date':
          whereClause.balanceDue = { [Op.lte]: 0 };
          break;
        case 'behind':
          whereClause.balanceDue = { [Op.gt]: 0 };
          break;
        case 'partial':
          whereClause.balanceDue = { [Op.gt]: 0 };
          whereClause.totalCollected = { [Op.gt]: 0 };
          break;
      }
    }

    const payments = await MemberPayment.findAndCountAll({
      where: whereClause,
      // include: [
      //   {
      //     model: Member,
      //     as: 'member',
      //     where: memberWhereClause,
      //     attributes: ['id', 'first_name', 'last_name', 'member_id', 'phone_number', 'email']
      //   }
      // ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['memberName', 'ASC']]
    });

    res.json({
      success: true,
      data: payments.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(payments.count / limit),
        totalItems: payments.count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching member payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch member payments' });
  }
};

// Get payment details for a specific member
const getMemberPaymentDetails = async (req, res) => {
  try {
    const { memberId } = req.params;

    const payment = await MemberPayment.findOne({
      where: { memberId },
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'member_id', 'phone_number', 'email', 'spouse_name']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error fetching member payment details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment details' });
  }
};

// Add or update payment for a member
const addMemberPayment = async (req, res) => {
  try {
    const { memberId, month, amount, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!memberId || !month || !amount || !paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Member ID, month, amount, and payment method are required' 
      });
    }

    // Find existing payment record
    const payment = await MemberPayment.findOne({ where: { memberId } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Member payment record not found' });
    }

    // Validate and update the specific month's payment
    const monthField = String(month).toLowerCase();
    const validMonths = [
      'january','february','march','april','may','june','july','august','september','october','november','december'
    ];
    if (!validMonths.includes(monthField)) {
      return res.status(400).json({ success: false, message: `Invalid month: ${month}` });
    }

    payment[monthField] = parseFloat(amount);
    payment.paymentMethod = paymentMethod;
    payment.notes = notes || payment.notes;

    // Recalculate totals
    const monthlyValues = validMonths.map(m => Number(payment[m] || 0));
    payment.totalCollected = monthlyValues.reduce((sum, v) => sum + v, 0);
    if (typeof payment.totalAmountDue === 'number') {
      payment.balanceDue = payment.totalAmountDue - payment.totalCollected;
    }

    await payment.save();

    res.json({ 
      success: true, 
      message: 'Payment updated successfully',
      data: payment 
    });
  } catch (error) {
    console.error('Error adding member payment:', error);
    res.status(500).json({ success: false, message: 'Failed to add payment' });
  }
};

// Generate payment reports (kept minimal and resilient)
const generatePaymentReport = async (req, res) => {
  try {
    const reportType = req.params.reportType || req.query.reportType || 'summary';

    if (reportType !== 'summary') {
      return res.status(400).json({ success: false, message: 'Only summary report is supported currently' });
    }

    // Try from MemberPayment; if table empty or not used, fallback to Transactions totals
    const [countPayments, totalAmountDue, totalCollected] = await Promise.all([
      MemberPayment.count().catch(() => 0),
      MemberPayment.sum('totalAmountDue').catch(() => 0),
      MemberPayment.sum('totalCollected').catch(() => 0)
    ]);

    let data;
    if (countPayments && (totalAmountDue !== null || totalCollected !== null)) {
      const upToDateMembers = await MemberPayment.count({ where: { totalAmountDue: { [Op.lte]: 0 } } }).catch(() => 0);
      const behindMembers = await MemberPayment.count({ where: { totalAmountDue: { [Op.gt]: 0 } } }).catch(() => 0);
      data = {
        totalMembers: countPayments,
        upToDateMembers,
        behindMembers,
        totalAmountDue: totalAmountDue || 0,
        totalCollected: totalCollected || 0,
        collectionRate: countPayments > 0 ? ((upToDateMembers / countPayments) * 100).toFixed(2) : '0',
        outstandingAmount: (totalAmountDue || 0) - (totalCollected || 0)
      };
    } else {
      // Fallback to transactions aggregation for current year
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      const totalAmount = await Transaction.sum('amount', { where: { payment_date: { [Op.gte]: start, [Op.lte]: end } } }).catch(() => 0);
      const uniqueMembers = await Transaction.findAll({
        where: { payment_date: { [Op.gte]: start, [Op.lte]: end } },
        attributes: [[literal('DISTINCT "member_id"'), 'member_id']],
        raw: true
      }).catch(() => []);
      data = {
        totalMembers: uniqueMembers.length,
        upToDateMembers: uniqueMembers.length,
        behindMembers: 0,
        totalAmountDue: totalAmount || 0,
        totalCollected: totalAmount || 0,
        collectionRate: uniqueMembers.length > 0 ? '100' : '0',
        outstandingAmount: 0
      };
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error generating payment report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// Get dues for the currently authenticated member (derived from Transactions only)
const getMyDues = async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid;
    if (!firebaseUid) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const member = await Member.findOne({ where: { firebase_uid: firebaseUid } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const months = [
      'january','february','march','april','may','june','july','august','september','october','november','december'
    ];
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();

    // Build from transactions only
    let monthlyPayment = 0;
    let monthStatuses = [];
    let totalCollected = 0;
    let totalAmountDue = 0;
    let balanceDue = 0;
    let futureDues = 0;

    const memberTransactions = await Transaction.findAll({
      where: {
        member_id: member.id,
        payment_date: { [Op.gte]: new Date(currentYear, 0, 1), [Op.lte]: new Date(currentYear, 11, 31, 23, 59, 59, 999) }
      },
      order: [['payment_date', 'ASC']]
    });
    // Separate membership due vs all other payments
    const duesTransactions = memberTransactions.filter(t => String(t.payment_type) === 'membership_due');
    const totalsByCalendarMonth = new Array(12).fill(0);
    for (const t of duesTransactions) {
      const d = new Date(t.payment_date);
      if (d.getFullYear() === currentYear) totalsByCalendarMonth[d.getMonth()] += Number(t.amount || 0);
    }

    // If member has yearly_pledge, allocate dues across months sequentially starting January
    const yearlyPledge = Number(member.yearly_pledge || 0);
    if (yearlyPledge > 0) {
      monthlyPayment = Math.round((yearlyPledge / 12) * 100) / 100;
      const totalDuesCollected = duesTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
      totalAmountDue = yearlyPledge;
      balanceDue = Math.max(yearlyPledge - totalDuesCollected, 0);

      let remaining = totalDuesCollected;
      monthStatuses = months.map((m, idx) => {
        const isFutureMonth = idx > currentMonthIndex;
        const paidForMonth = Math.min(monthlyPayment, Math.max(remaining, 0));
        remaining = Math.max(remaining - monthlyPayment, 0);
        const dueForMonth = Math.max(monthlyPayment - paidForMonth, 0);
        const status = paidForMonth >= monthlyPayment ? 'paid' : (idx <= currentMonthIndex ? 'due' : 'upcoming');
        return { month: m, paid: Number(paidForMonth.toFixed(2)), due: Number(dueForMonth.toFixed(2)), status, isFutureMonth };
      });
      totalCollected = totalDuesCollected;
      futureDues = monthStatuses.filter(ms => ms.isFutureMonth).reduce((s, m) => s + m.due, 0);
    } else {
      // No pledge set: show what was paid per calendar month for membership dues; dues remain 0
      monthStatuses = months.map((m, idx) => {
        const paid = totalsByCalendarMonth[idx] || 0;
        const isFutureMonth = idx > currentMonthIndex;
        return { month: m, paid, due: 0, status: paid > 0 ? 'paid' : (idx <= currentMonthIndex ? 'due' : 'upcoming'), isFutureMonth };
      });
      totalCollected = totalsByCalendarMonth.reduce((a, b) => a + b, 0);
      totalAmountDue = 0;
      balanceDue = 0;
      futureDues = 0;
    }

    // Build transaction history for display (all payment types for the year)
    const transactions = memberTransactions
      .map(t => ({
        id: t.id,
        payment_date: t.payment_date,
        amount: Number(t.amount || 0),
        payment_type: t.payment_type,
        payment_method: t.payment_method,
        receipt_number: t.receipt_number,
        note: t.note,
      }))
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    return res.json({
      success: true,
      data: {
        member: {
          id: member.id,
          firstName: member.first_name || member.firstName || '',
          lastName: member.last_name || member.lastName || '',
          email: member.email || '',
          phoneNumber: member.phone_number || member.phoneNumber || ''
        },
        payment: {
          year: currentYear,
          monthlyPayment,
          totalAmountDue,
          totalCollected,
          balanceDue,
          monthStatuses,
          futureDues
        },
        transactions
      }
    });
  } catch (error) {
    console.error('Error fetching my dues:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dues' });
  }
};

// Get payment statistics for dashboard (based on members.yearly_pledge and ledger_entries membership_due)
const getPaymentStats = async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    const currentMonth = now.getMonth() + 1; // 1-12

    // All real members
    const totalMembers = await Member.count();

    // Members with a non-zero pledge
    const contributingMembersList = await Member.findAll({
      where: { yearly_pledge: { [Op.gt]: 0 } },
      attributes: ['id', 'yearly_pledge'],
      raw: true
    });
    const contributingMembers = contributingMembersList.length;

    if (contributingMembers === 0) {
      // Even with no pledges, calculate other payments
      const otherPaymentsResult = await LedgerEntry.sum('amount', {
        where: {
          category: { [Op.ne]: 'membership_due' },
          entry_date: { [Op.gte]: start, [Op.lte]: end }
        }
      });
      const otherPayments = Number(otherPaymentsResult || 0);
      
      return res.json({
        success: true,
        data: {
          totalMembers,
          contributingMembers: 0,
          upToDateMembers: 0,
          behindMembers: 0,
          totalAmountDue: 0,
          totalMembershipCollected: 0,
          otherPayments: Number(otherPayments.toFixed(2)),
          totalCollected: Number(otherPayments.toFixed(2)),
          outstandingAmount: 0,
          collectionRate: 0
        }
      });
    }

    // Calculate total membership collected from ALL ledger_entries with category='membership_due' in current year
    const totalMembershipCollectedResult = await LedgerEntry.sum('amount', {
      where: {
        category: 'membership_due',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      }
    });
    let totalMembershipCollected = parseFloat(totalMembershipCollectedResult) || 0;
    // Ensure it's a valid number
    if (!Number.isFinite(totalMembershipCollected)) {
      totalMembershipCollected = 0;
    }

    // For calculating up-to-date vs behind members, we need per-member totals
    const paidRows = await LedgerEntry.findAll({
      where: {
        category: 'membership_due',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      },
      attributes: ['member_id', [literal('SUM("amount")'), 'paid_to_date']],
      group: ['member_id'],
      raw: true
    });

    const paidMap = new Map();
    for (const r of paidRows) {
      // r.paid_to_date may be string/number depending on dialect
      paidMap.set(String(r.member_id), Number(r.paid_to_date || 0));
    }

    let upToDateMembers = 0;
    let behindMembers = 0;
    let totalAmountDue = 0; // expected-to-date total across contributing members

    for (const m of contributingMembersList) {
      const pledge = Number(m.yearly_pledge || 0);
      if (pledge <= 0) continue;
      const expectedToDate = (pledge / 12) * currentMonth;
      const paidToDate = paidMap.get(String(m.id)) || 0;

      totalAmountDue += expectedToDate;
      if (paidToDate + 1e-6 >= expectedToDate) {
        upToDateMembers += 1;
      } else {
        behindMembers += 1;
      }
    }

    // Calculate other payments (all non-membership_due payments)
    const otherPaymentsResult = await LedgerEntry.sum('amount', {
      where: {
        category: { [Op.ne]: 'membership_due' },
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      }
    });
    let otherPayments = parseFloat(otherPaymentsResult) || 0;
    // Ensure it's a valid number
    if (!Number.isFinite(otherPayments)) {
      otherPayments = 0;
    }

    // Total collected = membership + other payments
    const totalCollected = totalMembershipCollected + otherPayments;

    // Calculate total expenses for the year
    const totalExpensesResult = await LedgerEntry.sum('amount', {
      where: {
        type: 'expense',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      }
    });
    let totalExpenses = parseFloat(totalExpensesResult) || 0;
    if (!Number.isFinite(totalExpenses)) {
      totalExpenses = 0;
    }

    // Calculate net income
    const netIncome = totalCollected - totalExpenses;

    const outstandingAmount = Math.max(totalAmountDue - totalMembershipCollected, 0);
    const collectionRate = contributingMembers > 0
      ? Number(((upToDateMembers / contributingMembers) * 100).toFixed(2))
      : 0;

    const stats = {
      totalMembers,
      contributingMembers,
      upToDateMembers,
      behindMembers,
      totalAmountDue: Number((totalAmountDue || 0).toFixed(2)),
      totalMembershipCollected: Number((totalMembershipCollected || 0).toFixed(2)),
      otherPayments: Number((otherPayments || 0).toFixed(2)),
      totalCollected: Number((totalCollected || 0).toFixed(2)),
      totalExpenses: Number((totalExpenses || 0).toFixed(2)),
      netIncome: Number((netIncome || 0).toFixed(2)),
      outstandingAmount: Number((outstandingAmount || 0).toFixed(2)),
      collectionRate
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment statistics' });
  }
};

// Get weekly collection report (income, expenses, and net deposits by payment method)
const getWeeklyReport = async (req, res) => {
  try {
    const { week_start } = req.query;
    
    // Calculate week start (Monday) and end (Sunday)
    let weekStart;
    if (week_start) {
      weekStart = new Date(week_start);
    } else {
      // Default to current week's Monday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday (0) or other days
      weekStart = new Date(today);
      weekStart.setDate(today.getDate() + diff);
    }
    
    // Ensure it's a Monday
    if (weekStart.getDay() !== 1) {
      return res.status(400).json({
        success: false,
        message: 'week_start must be a Monday'
      });
    }
    
    // Calculate week end (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Format dates for query
    const startDate = weekStart.toISOString().split('T')[0];
    const endDate = weekEnd.toISOString().split('T')[0];
    
    console.log('📅 Fetching weekly report from', startDate, 'to', endDate);
    
    // Query all transactions (income and expenses) for the week
    const transactions = await LedgerEntry.findAll({
      where: {
        entry_date: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        }
      },
      include: [
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          required: false
        }
      ],
      order: [['payment_method', 'ASC'], ['type', 'ASC'], ['amount', 'DESC']]
    });
    
    // Group transactions by payment method
    const byPaymentMethod = {};
    
    transactions.forEach(transaction => {
      const paymentMethod = transaction.payment_method || 'other';
      
      if (!byPaymentMethod[paymentMethod]) {
        byPaymentMethod[paymentMethod] = {
          income: [],
          expenses: [],
          totalIncome: 0,
          totalExpenses: 0,
          netToDeposit: 0
        };
      }
      
      const amount = parseFloat(transaction.amount) || 0;
      const collectorName = transaction.collector 
        ? `${transaction.collector.first_name} ${transaction.collector.last_name}`
        : 'System';
      
      const item = {
        id: transaction.id,
        type: transaction.type,
        category: transaction.category,
        collected_by: transaction.collected_by,
        collector_name: collectorName,
        amount: amount,
        entry_date: transaction.entry_date,
        receipt_number: transaction.receipt_number,
        memo: transaction.memo
      };
      
      if (transaction.type === 'expense') {
        byPaymentMethod[paymentMethod].expenses.push(item);
        byPaymentMethod[paymentMethod].totalExpenses += amount;
      } else {
        // All other types are income (payment, donation, pledge_payment, etc.)
        byPaymentMethod[paymentMethod].income.push(item);
        byPaymentMethod[paymentMethod].totalIncome += amount;
      }
    });
    
    // Calculate net to deposit for each payment method
    Object.keys(byPaymentMethod).forEach(method => {
      byPaymentMethod[method].netToDeposit = 
        byPaymentMethod[method].totalIncome - byPaymentMethod[method].totalExpenses;
    });
    
    // Calculate summary
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTransactions = transactions.length;
    const depositBreakdown = {};
    
    Object.keys(byPaymentMethod).forEach(method => {
      totalIncome += byPaymentMethod[method].totalIncome;
      totalExpenses += byPaymentMethod[method].totalExpenses;
      depositBreakdown[method] = byPaymentMethod[method].netToDeposit;
    });
    
    const netTotal = totalIncome - totalExpenses;
    
    // Format response
    const response = {
      weekStart: startDate,
      weekEnd: endDate,
      byPaymentMethod,
      summary: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netTotal: Number(netTotal.toFixed(2)),
        totalTransactions,
        depositBreakdown
      }
    };
    
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly report',
      error: error.message
    });
  }
};

module.exports = {
  getAllMemberPayments,
  getMemberPaymentDetails,
  addMemberPayment,
  generatePaymentReport,
  getPaymentStats,
  getWeeklyReport,
  getMyDues,
  getDuesByMemberIdWithAuth
};

// Fetch dues for a specific memberId with authorization:
// - Allow if caller is the same member (by firebase_uid)
// - Allow if caller is a Dependent whose linkedMemberId === memberId
async function getDuesByMemberIdWithAuth(req, res) {
  try {
    const { memberId } = req.params;
    const firebaseUid = req.firebaseUid;
    const firebasePhone = req.firebasePhone;
    if (!firebaseUid) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 1) Caller is a Member?
    const callerMember = await Member.findOne({ where: { firebase_uid: firebaseUid } });
    if (callerMember && String(callerMember.id) === String(memberId)) {
      return computeAndReturnDues(res, callerMember);
    }

    // 2) Caller is a Dependent linked to this member?
    // We use phone match from Firebase token (E.164) per project policy: phone-only auth.
    if (!callerMember && firebasePhone) {
      const callerDependent = await Dependent.findOne({ where: { phone: firebasePhone } });
      if (callerDependent && String(callerDependent.linkedMemberId || callerDependent.memberId) === String(memberId)) {
        // If linkedMemberId exists, we treat that as head-of-household. Otherwise fallback to memberId field.
        const targetMemberId = callerDependent.linkedMemberId || callerDependent.memberId;
        const member = await Member.findOne({ where: { id: targetMemberId } });
        if (!member) {
          return res.status(404).json({ success: false, message: 'Member not found for dependent link' });
        }
        return computeAndReturnDues(res, member);
      }
    }

    return res.status(403).json({ success: false, message: 'Forbidden' });
  } catch (error) {
    console.error('Error fetching dues by member with auth:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dues' });
  }
}

// Helper to compute and return dues for a given Member instance (reuses getMyDues logic)
async function computeAndReturnDues(res, member) {
  const months = [
    'january','february','march','april','may','june','july','august','september','october','november','december'
  ];
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();

  let monthlyPayment = 0;
  let monthStatuses = [];
  let totalCollected = 0;
  let totalAmountDue = 0;
  let balanceDue = 0;
  let futureDues = 0;

  const memberTransactions = await Transaction.findAll({
    where: {
      member_id: member.id,
      payment_date: { [Op.gte]: new Date(currentYear, 0, 1), [Op.lte]: new Date(currentYear, 11, 31, 23, 59, 59, 999) }
    },
    order: [['payment_date', 'ASC']]
  });
  const duesTransactions = memberTransactions.filter(t => String(t.payment_type) === 'membership_due');
  const totalsByCalendarMonth = new Array(12).fill(0);
  for (const t of duesTransactions) {
    const d = new Date(t.payment_date);
    if (d.getFullYear() === currentYear) totalsByCalendarMonth[d.getMonth()] += Number(t.amount || 0);
  }

  const yearlyPledge = Number(member.yearly_pledge || 0);
  if (yearlyPledge > 0) {
    monthlyPayment = Math.round((yearlyPledge / 12) * 100) / 100;
    const totalDuesCollected = duesTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
    totalAmountDue = yearlyPledge;
    balanceDue = Math.max(yearlyPledge - totalDuesCollected, 0);

    let remaining = totalDuesCollected;
    monthStatuses = months.map((m, idx) => {
      const isFutureMonth = idx > currentMonthIndex;
      const paidForMonth = Math.min(monthlyPayment, Math.max(remaining, 0));
      remaining = Math.max(remaining - monthlyPayment, 0);
      const dueForMonth = Math.max(monthlyPayment - paidForMonth, 0);
      const status = paidForMonth >= monthlyPayment ? 'paid' : (idx <= currentMonthIndex ? 'due' : 'upcoming');
      return { month: m, paid: Number(paidForMonth.toFixed(2)), due: Number(dueForMonth.toFixed(2)), status, isFutureMonth };
    });
    totalCollected = totalDuesCollected;
    futureDues = monthStatuses.filter(ms => ms.isFutureMonth).reduce((s, m) => s + m.due, 0);
  } else {
    monthStatuses = months.map((m, idx) => {
      const paid = totalsByCalendarMonth[idx] || 0;
      const isFutureMonth = idx > currentMonthIndex;
      return { month: m, paid, due: 0, status: paid > 0 ? 'paid' : (idx <= currentMonthIndex ? 'due' : 'upcoming'), isFutureMonth };
    });
    totalCollected = totalsByCalendarMonth.reduce((a, b) => a + b, 0);
    totalAmountDue = 0;
    balanceDue = 0;
    futureDues = 0;
  }

  const transactions = memberTransactions
    .map(t => ({
      id: t.id,
      payment_date: t.payment_date,
      amount: Number(t.amount || 0),
      payment_type: t.payment_type,
      payment_method: t.payment_method,
      receipt_number: t.receipt_number,
      note: t.note,
    }))
    .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

  return res.json({
    success: true,
    data: {
      member: {
        id: member.id,
        firstName: member.first_name || member.firstName || '',
        lastName: member.last_name || member.lastName || '',
        email: member.email || '',
        phoneNumber: member.phone_number || member.phoneNumber || ''
      },
      payment: {
        year: currentYear,
        monthlyPayment,
        totalAmountDue,
        totalCollected,
        balanceDue,
        monthStatuses,
        futureDues
      },
      transactions
    }
  });
}