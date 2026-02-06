const { MemberPayment, Member, Transaction, Dependent, LedgerEntry, Title, BankTransaction } = require('../models');
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
      'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'
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

    const { year } = req.query;
    return computeAndReturnDues(res, member, year);
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
          type: { [Op.ne]: 'membership_due' },
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

    // Calculate total membership collected from ALL ledger_entries with type='membership_due' in current year
    const totalMembershipCollectedResult = await LedgerEntry.sum('amount', {
      where: {
        type: 'membership_due',
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
        type: 'membership_due',
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
        type: { [Op.ne]: 'membership_due' },
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

    // Fetch latest bank balance
    console.log('--- DEBUG: Fetching Bank Balance in memberPaymentController ---');
    const latestBankTxn = await BankTransaction.findOne({
      where: {
        balance: { [Op.ne]: null }
      },
      order: [['date', 'DESC'], ['id', 'DESC']],
      attributes: ['id', 'balance', 'date', ['created_at', 'createdAt']]
    });

    if (latestBankTxn) {
      console.log('--- DEBUG: Bank Transaction Found ---');
      console.log('Raw Balance:', latestBankTxn.balance);
    } else {
      console.log('--- DEBUG: No Bank Transaction Found ---');
    }

    const currentBankBalance = latestBankTxn && latestBankTxn.balance ? parseFloat(latestBankTxn.balance) : 0;
    const lastBankUpdate = latestBankTxn ? (latestBankTxn.get('createdAt') || latestBankTxn.date) : null;

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
      collectionRate,
      currentBankBalance,
      lastBankUpdate
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
      // Parse date string in local timezone to avoid UTC conversion issues
      const [year, month, day] = week_start.split('-').map(Number);
      weekStart = new Date(year, month - 1, day);
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
      // Calculate the nearest Monday (before the provided date)
      const dayOfWeek = weekStart.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, adjust to previous Monday
      const nearestMonday = new Date(weekStart);
      nearestMonday.setDate(weekStart.getDate() - daysToSubtract);
      const formattedMonday = nearestMonday.toISOString().split('T')[0];

      return res.status(400).json({
        success: false,
        message: `week_start must be a Monday. You provided ${week_start} (${weekStart.toDateString()}), which is a ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}. Try using ${formattedMonday} instead.`
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
          as: 'member',
          attributes: ['id', 'first_name', 'last_name'],
          required: false
        },
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
      const memberName = transaction.member
        ? `${transaction.member.first_name} ${transaction.member.last_name}`
        : null;

      const item = {
        id: transaction.id,
        type: transaction.type,
        category: transaction.category,
        member_id: transaction.member_id,
        member_name: memberName,
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

// Get dues for any member (treasurer only) - same as getMyDues but for any member
const getMemberDuesForTreasurer = async (req, res) => {
  try {
    const { memberId } = req.params;

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Member ID is required' });
    }

    const member = await Member.findOne({
      where: { id: memberId },
      include: [{ model: Title, as: 'title' }]
    });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { year } = req.query;
    // Reuse the same logic as getMyDues but for any member
    return computeAndReturnDues(res, member, year);
  } catch (error) {
    console.error('Error fetching member dues for treasurer:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch member dues' });
  }
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

    const { year } = req.query;
    // 1) Caller is a Member?
    const callerMember = await Member.findOne({
      where: { firebase_uid: firebaseUid },
      include: [{ model: Title, as: 'title' }]
    });
    if (callerMember && String(callerMember.id) === String(memberId)) {
      return computeAndReturnDues(res, callerMember, year);
    }

    // 2) Caller is a Dependent linked to this member?
    // We use phone match from Firebase token (E.164) per project policy: phone-only auth.
    if (!callerMember && firebasePhone) {
      const callerDependent = await Dependent.findOne({ where: { phone: firebasePhone } });
      if (callerDependent && String(callerDependent.linkedMemberId || callerDependent.memberId) === String(memberId)) {
        // If linkedMemberId exists, we treat that as head-of-household. Otherwise fallback to memberId field.
        const targetMemberId = callerDependent.linkedMemberId || callerDependent.memberId;
        const member = await Member.findOne({
          where: { id: targetMemberId },
          include: [{ model: Title, as: 'title' }]
        });
        if (!member) {
          return res.status(404).json({ success: false, message: 'Member not found for dependent link' });
        }
        return computeAndReturnDues(res, member, year);
      }
    }

    return res.status(403).json({ success: false, message: 'Forbidden' });
  } catch (error) {
    console.error('Error fetching dues by member with auth:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dues' });
  }
}

// Helper to compute and return dues for a given Member instance (reuses getMyDues logic)
async function computeAndReturnDues(res, member, requestedYear) {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const now = new Date();
  const currentYear = now.getFullYear();
  const year = requestedYear ? parseInt(requestedYear) : currentYear;

  // currentMonthIndex logic:
  // - If year < currentYear: all months are in the past (11)
  // - If year > currentYear: all months are in the future (-1)
  // - If year === currentYear: use current month index
  let currentMonthIndex;
  if (year < currentYear) {
    currentMonthIndex = 11;
  } else if (year > currentYear) {
    currentMonthIndex = -1;
  } else {
    currentMonthIndex = now.getMonth();
  }

  let monthlyPayment = 0;
  let monthStatuses = [];
  let totalCollected = 0;
  let totalAmountDue = 0;
  let balanceDue = 0;
  let futureDues = 0;

  // 1. Identify Family Members

  // Determine the effective family ID (either the assigned family_id or the member's own ID)
  const effectiveFamilyId = member.family_id || member.id;

  // Find all members who belong to this family (including the HoH if they have family_id set, and any dependents)
  const familyMembers = await Member.findAll({
    where: {
      [Op.or]: [
        { family_id: effectiveFamilyId },
        { id: effectiveFamilyId }
      ]
    },
    attributes: ['id', 'first_name', 'last_name', 'yearly_pledge', 'family_id', 'date_joined_parish'],
    include: [{ model: Title, as: 'title' }]
  });

  const familyMemberIds = familyMembers.map(m => m.id);

  // 2. Identify Head of Household
  // Head of Household is either:
  // - The member with family_id = null or family_id = their own id
  // - The member with the highest yearly_pledge
  // - The member with id = effectiveFamilyId
  let headOfHousehold = familyMembers.find(m =>
    !m.family_id || String(m.family_id) === String(m.id) || String(m.id) === String(effectiveFamilyId)
  );

  // If not found by family_id logic, use the one with the highest pledge
  if (!headOfHousehold) {
    if (familyMembers.length > 0) {
      headOfHousehold = familyMembers.reduce((prev, current) =>
        (Number(current.yearly_pledge || 0) > Number(prev.yearly_pledge || 0)) ? current : prev
      );
    }
  }

  // Determine join date from head of household
  const joinDateStr = headOfHousehold.date_joined_parish;
  let joinYear = 0;
  let joinMonth = 0;
  if (joinDateStr) {
    const parts = joinDateStr.split('-');
    joinYear = parseInt(parts[0]);
    joinMonth = parseInt(parts[1]) - 1; // 0-indexed month
  }

  // Determine if this is a household view (multiple family members)
  const isHouseholdView = familyMembers.length > 1;
  const householdMemberNames = familyMembers
    .filter(m => String(m.id) !== String(headOfHousehold.id))
    .map(m => m.first_name)
    .join(', ');

  // 2. Fetch Transactions
  // We need two sets:
  // A. ALL historical "membership_due" transactions for this family (for rollover calculation)
  // B. Transactions to display for this specific year (for the list view)

  // Fetch A: All historical dues
  const allDuesTransactions = await Transaction.findAll({
    where: {
      member_id: { [Op.in]: familyMemberIds },
      payment_type: 'membership_due'
    },
    raw: true
  });

  // Calculate Rollover (Surplus from previous years)
  // We assume the current yearly_pledge applies retroactively as we don't track historical pledge changes.
  let rolloverAmount = 0;
  const yearlyPledge = Number(headOfHousehold.yearly_pledge || 0);

  if (yearlyPledge > 0) {
    // Determine start year for calculation (Join Year or reasonable default)
    let startCalcYear = joinYear;
    if (!startCalcYear) {
      // If no join date, try to infer from first transaction, otherwise default to requested year
      if (allDuesTransactions.length > 0) {
        const firstTxnDate = new Date(Math.min(...allDuesTransactions.map(t => new Date(t.payment_date))));
        startCalcYear = firstTxnDate.getFullYear();
      } else {
        startCalcYear = year;
      }
    }

    // Loop from start year up to the year BEFORE the requested year
    for (let y = startCalcYear; y < year; y++) {
      // 1. Calculate Dues for Year Y
      let duesForY = yearlyPledge;
      // Adjust if it's the join year
      if (y === joinYear && joinDateStr) {
        // e.g. Joined in March (index 2). Dues = monthly * (12 - 2) = 10 months.
        const monthlyForY = yearlyPledge / 12;
        duesForY = monthlyForY * (12 - joinMonth);
      }

      // 2. Calculate Payments for Year Y (Available)
      // Payments explicitly for Y OR (Payments with no year AND dated in Y)
      const paymentsForY = allDuesTransactions.filter(t => {
        // robust year check
        const tDate = new Date(t.payment_date); // careful with timezone, usually YYYY-MM-DD matches UTC if simple string
        // Better: parse string manually to be safe like we do below
        const tY = t.payment_date instanceof Date
          ? t.payment_date.getFullYear()
          : parseInt(String(t.payment_date).split('-')[0]);

        if (t.for_year === y) return true;
        if (!t.for_year && tY === y) return true;
        return false;
      }).reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalAvailableForY = paymentsForY + rolloverAmount;

      // 3. Determine Surplus
      // We satisfy the dues first. Any remainder is surplus.
      if (totalAvailableForY > duesForY) {
        rolloverAmount = totalAvailableForY - duesForY;
      } else {
        rolloverAmount = 0; // Debt doesn't carry forward as negative surplus in this logic, we strictly track 'extra'
      }
    }
  }

  // Fetch B: Display Transactions for the requested year
  // STRICTLY purely by payment_date (Cash Flow View)
  const memberTransactions = await Transaction.findAll({
    where: {
      member_id: { [Op.in]: familyMemberIds },
      payment_date: { [Op.gte]: `${year}-01-01`, [Op.lte]: `${year}-12-31` }
    },
    include: [
      {
        model: Member,
        as: 'member',
        attributes: ['first_name']
      }
    ],
    order: [['payment_date', 'ASC']]
  });

  // Calculate Allocated Dues for THIS Year (Accrual View)
  const duesAllocatedForYear = allDuesTransactions.filter(t => {
    const tDate = new Date(t.payment_date);
    const tY = t.payment_date instanceof Date
      ? t.payment_date.getFullYear()
      : parseInt(String(t.payment_date).split('-')[0]);

    if (t.for_year === year) return true;
    if (!t.for_year && tY === year) return true;
    return false;
  }).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  if (yearlyPledge > 0) {
    monthlyPayment = Math.round((yearlyPledge / 12) * 100) / 100;

    // Total Dues Collected = (Directly Allocated to Year) + (Rollover from previous)
    const totalDuesCollected = duesAllocatedForYear + rolloverAmount;

    // Membership requirement logic
    let monthsRequired = 12;
    if (joinDateStr) {
      if (year < joinYear) {
        monthsRequired = 0;
      } else if (year === joinYear) {
        monthsRequired = 12 - joinMonth;
      }
    }

    totalAmountDue = Number((monthlyPayment * monthsRequired).toFixed(2));
    balanceDue = Math.max(totalAmountDue - totalDuesCollected, 0);

    // Waterfall logic for month statuses
    let remaining = totalDuesCollected;
    monthStatuses = months.map((m, idx) => {
      const isPreMembership = joinDateStr && (year < joinYear || (year === joinYear && idx < joinMonth));
      if (isPreMembership) {
        return { month: m, paid: 0, due: 0, status: 'pre-membership', isFutureMonth: false };
      }

      const isFutureMonth = idx > currentMonthIndex;

      // How much can we pay for this month?
      const paidForMonth = Math.min(monthlyPayment, Math.max(remaining, 0));
      remaining = Math.max(remaining - monthlyPayment, 0);

      const dueForMonth = Math.max(monthlyPayment - paidForMonth, 0);
      const status = paidForMonth >= monthlyPayment ? 'paid' : (idx <= currentMonthIndex ? 'due' : 'upcoming');
      return { month: m, paid: Number(paidForMonth.toFixed(2)), due: Number(dueForMonth.toFixed(2)), status, isFutureMonth };
    });

    totalCollected = totalDuesCollected; // This includes the rollover
    futureDues = monthStatuses.filter(ms => ms.isFutureMonth && ms.status !== 'pre-membership').reduce((s, m) => s + m.due, 0);
  } else {
    // ... No Pledge Logic (Keep existing simple view) ...
    const totalsByCalendarMonth = new Array(12).fill(0);
    for (const t of memberTransactions) { // Use the strictly-this-year ledger
      const parts = String(t.payment_date).split('-');
      const transMonth = parseInt(parts[1]) - 1;
      totalsByCalendarMonth[transMonth] += Number(t.amount || 0);
    }

    monthStatuses = months.map((m, idx) => {
      const isPreMembership = joinDateStr && (year < joinYear || (year === joinYear && idx < joinMonth));
      if (isPreMembership) {
        return { month: m, paid: 0, due: 0, status: 'pre-membership', isFutureMonth: false };
      }
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
      for_year: t.for_year, // Include for display
      note: t.note,
      paid_by: t.member ? t.member.first_name : 'Unknown'
    }))
    .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

  // Calculate other contributions breakdown
  const otherTransactions = memberTransactions.filter(t => String(t.payment_type) !== 'membership_due');
  const contributionsByType = {
    donation: 0,
    pledge_payment: 0,
    tithe: 0,
    offering: 0,
    other: 0
  };

  otherTransactions.forEach(t => {
    const amount = Number(t.amount || 0);
    const type = String(t.payment_type);

    if (contributionsByType.hasOwnProperty(type)) {
      contributionsByType[type] += amount;
    } else {
      contributionsByType.other += amount;
    }
  });

  const totalOtherContributions = Object.values(contributionsByType).reduce((sum, val) => sum + val, 0);
  const grandTotal = totalCollected + totalOtherContributions;

  return res.json({
    success: true,
    data: {
      member: {
        id: member.id,
        firstName: member.first_name || member.firstName || '',
        lastName: member.last_name || member.lastName || '',
        email: member.email || '',
        phoneNumber: member.phone_number || member.phoneNumber || '',
        title: member.title
      },
      household: {
        isHouseholdView,
        headOfHousehold: {
          id: headOfHousehold.id,
          firstName: headOfHousehold.first_name,
          lastName: headOfHousehold.last_name,
          title: headOfHousehold.title
        },
        memberNames: householdMemberNames,
        totalMembers: familyMembers.length
      },
      payment: {
        year: year,
        // Membership Dues Section
        annualPledge: yearlyPledge,
        monthlyPayment,
        duesCollected: totalCollected,
        outstandingDues: balanceDue,
        totalAmountDue: totalAmountDue,
        duesProgress: totalAmountDue > 0 ? Math.round((totalCollected / totalAmountDue) * 100) : 0,
        monthStatuses,

        // Other Contributions Section
        otherContributions: contributionsByType,
        totalOtherContributions,

        // Grand Total
        grandTotal
      },
      transactions
    }
  });
};

module.exports = {
  getAllMemberPayments,
  getMemberPaymentDetails,
  addMemberPayment,
  generatePaymentReport,
  getPaymentStats,
  getWeeklyReport,
  getMyDues,
  getDuesByMemberIdWithAuth,
  getMemberDuesForTreasurer,
  computeAndReturnDues // Exported for testing
};