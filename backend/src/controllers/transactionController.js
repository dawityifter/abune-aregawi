const { Transaction, Member, LedgerEntry, IncomeCategory, sequelize, BankTransaction } = require('../models');
const { Op } = require('sequelize');
const tz = require('../config/timezone');

// Get all transactions with optional filtering
const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      member_id,
      payment_type,
      payment_method,
      start_date,
      end_date,
      min_amount,
      max_amount,
      search,
      receipt_number
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Add filters
    if (member_id) whereClause.member_id = member_id;
    if (payment_type) whereClause.payment_type = payment_type;
    if (payment_method) whereClause.payment_method = payment_method;
    if (receipt_number) {
      whereClause.receipt_number = { [Op.iLike]: `%${receipt_number}%` };
    }
    if (start_date || end_date) {
      whereClause.payment_date = {};
      if (start_date) whereClause.payment_date[Op.gte] = start_date;
      if (end_date) whereClause.payment_date[Op.lte] = end_date;
    }
    if (min_amount || max_amount) {
      whereClause.amount = {};
      if (min_amount) whereClause.amount[Op.gte] = parseFloat(min_amount);
      if (max_amount) whereClause.amount[Op.lte] = parseFloat(max_amount);
    }

    // Build includes, adding a search filter on member if provided
    // Member can be null for anonymous donations
    const memberInclude = {
      model: Member,
      as: 'member',
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number'],
      required: false // Allow null member_id for anonymous donations
    };

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const tokens = term.split(/\s+/).filter(Boolean);

      // Build an AND of token-matchers, where each token can match any of the name/email/phone fields
      const tokenClauses = tokens.map(t => ({
        [Op.or]: [
          { first_name: { [Op.iLike]: `%${t}%` } },
          { middle_name: { [Op.iLike]: `%${t}%` } },
          { last_name: { [Op.iLike]: `%${t}%` } },
          { email: { [Op.iLike]: `%${t}%` } },
          { phone_number: { [Op.iLike]: `%${t}%` } }
        ]
      }));

      memberInclude.where = {
        [Op.and]: tokenClauses
      };
      memberInclude.required = true; // When searching, only show matching members (excludes anonymous)
    }

    const includes = [
      memberInclude,
      {
        model: Member,
        as: 'collector',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
      },
      {
        model: IncomeCategory,
        as: 'incomeCategory',
        attributes: ['id', 'gl_code', 'name', 'description'],
        required: false
      }
    ];

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where: whereClause,
      include: includes,
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

// Get a single transaction by ID
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number'],
          required: false // Allow null for anonymous donations
        },
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: { transaction }
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
};

// Create a new transaction with dual-write to ledger_entries
const createTransaction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      member_id,
      collected_by,
      payment_date,
      amount,
      payment_type,
      payment_method,
      receipt_number,
      note,
      external_id,
      status = 'succeeded', // Default transaction status
      donation_id,
      income_category_id, // New: GL code support
      // Anonymous donor fields
      donor_type,
      donor_name,
      donor_email,
      donor_phone,
      donor_memo,
      for_year // Add for_year support
    } = req.body;

    // Validate required fields (member_id is optional for anonymous donations)
    if (!collected_by || !amount || !payment_type || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: collected_by, amount, payment_type, payment_method'
      });
    }

    // Validate: membership_due requires a member_id
    if (!member_id && payment_type === 'membership_due') {
      return res.status(400).json({
        success: false,
        message: 'Membership dues cannot be paid anonymously. A member must be selected.'
      });
    }

    // Validate amount (minimum $1)
    if (parseFloat(amount) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least $1.00'
      });
    }

    // Validate receipt number for cash/check payments
    if (['cash', 'check'].includes(payment_method) && !receipt_number) {
      return res.status(400).json({
        success: false,
        message: 'Receipt number is required for cash and check payments'
      });
    }

    // Determine GL code from income_category_id or auto-assign from payment_type
    let glCode = payment_type; // Fallback to payment_type for backward compatibility
    let finalIncomeCategoryId = income_category_id;

    if (income_category_id) {
      // User explicitly selected an income category
      const incomeCategory = await IncomeCategory.findByPk(income_category_id);
      if (incomeCategory) {
        glCode = incomeCategory.gl_code;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid income category ID'
        });
      }
    } else {
      // Auto-assign income category based on payment_type mapping
      let incomeCategory = await IncomeCategory.findOne({
        where: { payment_type_mapping: payment_type }
      });

      // Fallback mappings for payment types without direct mapping
      if (!incomeCategory) {
        const fallbackMappings = {
          'tithe': 'offering',        // tithe → INC002 (Weekly Offering)
          'building_fund': 'event'    // building_fund → INC003 (Fundraising)
        };

        const fallbackType = fallbackMappings[payment_type];
        if (fallbackType) {
          incomeCategory = await IncomeCategory.findOne({
            where: { payment_type_mapping: fallbackType }
          });
        }
      }

      if (incomeCategory) {
        finalIncomeCategoryId = incomeCategory.id;
        glCode = incomeCategory.gl_code;
      }
    }

    // Build donor info note if anonymous donation
    let finalNote = note || '';
    if (!member_id && (donor_name || donor_email || donor_phone || donor_memo || donor_type)) {
      const donorInfo = [];
      if (donor_type) donorInfo.push(`Type: ${donor_type}`);
      if (donor_name) donorInfo.push(`Name: ${donor_name}`);
      if (donor_email) donorInfo.push(`Email: ${donor_email}`);
      if (donor_phone) donorInfo.push(`Phone: ${donor_phone}`);
      if (donor_memo) donorInfo.push(`Memo: ${donor_memo}`);

      const donorSection = `[Anonymous Donor]\n${donorInfo.join('\n')}`;
      finalNote = finalNote ? `${donorSection}\n\n${finalNote}` : donorSection;
    }

    // Normalize and map statuses between transactions and ledger entries
    const txStatus = status === 'completed'
      ? 'succeeded'
      : (status === 'cancelled' ? 'canceled' : status);
    // Ledger uses 'completed' and 'cancelled'
    const ledgerStatus = txStatus === 'succeeded'
      ? 'completed'
      : (txStatus === 'canceled' ? 'cancelled' : txStatus);

    // Verify that collector exists and member exists (if provided)
    const collector = await Member.findByPk(collected_by);
    if (!collector) {
      return res.status(400).json({
        success: false,
        message: 'Collector not found'
      });
    }

    // Verify member exists only if member_id is provided (not anonymous)
    if (member_id) {
      const member = await Member.findByPk(member_id);
      if (!member) {
        return res.status(400).json({
          success: false,
          message: 'Member not found'
        });
      }
    }

    // 1. If external_id provided, check for existing transaction
    let transaction = null;
    if (external_id) {
      transaction = await Transaction.findOne({
        where: { external_id },
        transaction: t
      });

      if (transaction) {
        // Update existing transaction and its ledger entries
        await Promise.all([
          transaction.update({
            member_id,
            collected_by,
            payment_date: payment_date || new Date(),
            amount: parseFloat(amount),
            payment_type,
            payment_method,
            receipt_number,
            note: finalNote,
            status: txStatus,
            status: txStatus,
            donation_id: donation_id || transaction.donation_id,
            income_category_id: finalIncomeCategoryId,
            for_year: for_year || transaction.for_year // Update for_year if provided
          }, { transaction: t }),

          // Update corresponding ledger entries
          LedgerEntry.destroy({
            where: { transaction_id: transaction.id },
            transaction: t
          })
        ]);
      }
    }

    // 2. If no external_id provided, check for recent logical duplicates (prevent rapid double-clicks without keys)
    if (!transaction && !external_id) {
      const recentDuplicate = await Transaction.findOne({
        where: {
          member_id: member_id || null,
          amount: parseFloat(amount),
          payment_date: payment_date ? tz.parseDate(payment_date) : tz.now(),
          payment_type,
          receipt_number: receipt_number || null,
          // Only check manual payments for logical duplicates
          payment_method: { [Op.notIn]: ['credit_card', 'ach'] },
          created_at: {
            [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) // 5 minute window
          }
        },
        transaction: t
      });

      if (recentDuplicate) {
        console.warn(`[Transaction] Suppressing potential duplicate for member ${member_id} - amount ${amount}`);
        await t.rollback();
        return res.status(200).json({
          success: true,
          message: 'Transaction recently recorded. Duplicate suppressed.',
          data: { transaction: recentDuplicate, isDuplicate: true }
        });
      }
    }

    // Create new transaction if it doesn't exist
    if (!transaction) {
      transaction = await Transaction.create({
        member_id,
        collected_by,
        payment_date: payment_date ? tz.parseDate(payment_date) : tz.now(),
        amount: parseFloat(amount),
        payment_type,
        payment_method,
        receipt_number,
        note: finalNote,
        external_id: external_id || null,
        status: txStatus,
        donation_id: donation_id || null,
        income_category_id: finalIncomeCategoryId,
        for_year: for_year || null
      }, { transaction: t });
    }

    // Create corresponding ledger entry using Sequelize (avoids enum issues)
    // Wrapped in try-catch to make ledger entries optional (for gradual migration)
    try {
      const entryDate = payment_date ? tz.parseDate(payment_date) : tz.now();
      const memo = `${glCode} - ${finalNote || 'No description'}`;

      await LedgerEntry.create({
        type: payment_type, // Keep payment_type for backward compatibility
        category: glCode, // Use GL code for categorization (INC001, INC002, etc.)
        amount: parseFloat(amount),
        entry_date: entryDate,
        payment_method,
        receipt_number: receipt_number || null,
        memo,
        collected_by,
        member_id,
        transaction_id: transaction.id,
        source_system: 'manual',
        external_id: external_id || null,
        fund: null,
        attachment_url: null,
        statement_date: null
      }, { transaction: t });
    } catch (ledgerError) {
      // Ledger entries are optional - log error but don't fail transaction
      console.warn('⚠️  Could not create ledger entry (table may not exist):', ledgerError.message);
    }

    // Fetch the created transaction with associations and ledger entries
    const createdTransaction = await Transaction.findByPk(transaction.id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number'],
          required: false // Allow null for anonymous donations
        },
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: IncomeCategory,
          as: 'incomeCategory',
          attributes: ['id', 'gl_code', 'name', 'description'],
          required: false
        }
      ],
      transaction: t
    });

    // Commit the transaction
    await t.commit();

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully with ledger entries',
      data: {
        transaction: createdTransaction
      }
    });
  } catch (error) {
    // Rollback the transaction in case of error
    await t.rollback();

    console.error('❌ Error creating transaction:', error);
    console.error('Error details:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Error stack:', error.stack);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
};

// Update a transaction and its associated ledger entries
const updateTransaction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find the transaction within the transaction
    const transaction = await Transaction.findByPk(id, { transaction: t });
    if (!transaction) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Validate amount if provided (minimum $1)
    if (updateData.amount && parseFloat(updateData.amount) < 1) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least $1.00'
      });
    }

    // Validate receipt number for cash/check payments
    if (updateData.payment_method && ['cash', 'check'].includes(updateData.payment_method) && !updateData.receipt_number) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Receipt number is required for cash and check payments'
      });
    }

    // Verify that both member and collector exist if they're being updated
    if (updateData.member_id) {
      const member = await Member.findByPk(updateData.member_id, { transaction: t });
      if (!member) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Member not found'
        });
      }
    }

    if (updateData.collected_by) {
      const collector = await Member.findByPk(updateData.collected_by, { transaction: t });
      if (!collector) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Collector not found'
        });
      }
    }

    // Update the transaction
    await transaction.update(updateData, { transaction: t });

    // Delete existing ledger entries for this transaction
    await LedgerEntry.destroy({
      where: { transaction_id: id },
      transaction: t
    });

    // Recreate a single income ledger entry aligned with current schema
    const entryDate = updateData.payment_date || transaction.payment_date || new Date();
    const paymentType = updateData.payment_type || transaction.payment_type;
    const paymentMethod = updateData.payment_method || transaction.payment_method;
    const amount = updateData.amount ? parseFloat(updateData.amount) : transaction.amount;
    const memberId = updateData.member_id || transaction.member_id;
    const collectedById = updateData.collected_by || transaction.collected_by;
    const receiptNumber = updateData.receipt_number || transaction.receipt_number || null;
    const note = updateData.note || transaction.note || '';
    const memo = `${paymentType} - ${note || 'No description'}`;

    // Create ledger entry using Sequelize (avoids enum issues)
    // Wrapped in try-catch to make ledger entries optional
    try {
      await LedgerEntry.create({
        type: paymentType, // Use paymentType directly - Sequelize handles it as STRING
        category: paymentType,
        amount: amount,
        entry_date: entryDate,
        payment_method: paymentMethod,
        receipt_number: receiptNumber,
        memo,
        collected_by: collectedById,
        member_id: memberId,
        transaction_id: id,
        source_system: 'manual',
        external_id: null,
        fund: null,
        attachment_url: null,
        statement_date: null
      }, { transaction: t });
    } catch (ledgerError) {
      console.warn('⚠️  Could not create ledger entry:', ledgerError.message);
    }

    // Fetch the updated transaction with associations
    const updatedTransaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }
      ],
      transaction: t
    });
    // Commit the transaction
    await t.commit();

    res.json({
      success: true,
      message: 'Transaction and ledger entries updated successfully',
      data: {
        transaction: updatedTransaction
      }
    });
  } catch (error) {
    // Rollback the transaction in case of error
    if (t && !t.finished) {
      await t.rollback();
    }

    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction and ledger entries',
      error: error.message
    });
  }
};

// Delete a transaction and its associated ledger entries
const deleteTransaction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Find the transaction within the transaction
    const transaction = await Transaction.findByPk(id, {
      include: [
        {
          model: LedgerEntry,
          as: 'ledgerEntries',
          attributes: ['id']
        }
      ],
      transaction: t
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Delete associated ledger entries first (if any)
    if (transaction.ledgerEntries && transaction.ledgerEntries.length > 0) {
      await LedgerEntry.destroy({
        where: { transaction_id: id },
        transaction: t
      });
    }

    // Delete the transaction
    await transaction.destroy({ transaction: t });

    // Commit the transaction
    await t.commit();

    res.json({
      success: true,
      message: 'Transaction and associated ledger entries deleted successfully',
      data: {
        transaction_id: id,
        deleted_ledger_entries_count: transaction.ledgerEntries ? transaction.ledgerEntries.length : 0
      }
    });
  } catch (error) {
    // Rollback the transaction in case of error
    if (t && !t.finished) {
      await t.rollback();
    }

    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction and associated ledger entries',
      error: error.message
    });
  }
};

// Get transaction statistics for dashboard (compatible with payment stats format)
const getTransactionStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const dateFilter = {};
    const expenseDateFilter = {};

    if (start_date || end_date) {
      dateFilter.payment_date = {};
      expenseDateFilter.entry_date = {};

      if (start_date) {
        dateFilter.payment_date[Op.gte] = start_date;
        expenseDateFilter.entry_date[Op.gte] = start_date;
      }
      if (end_date) {
        dateFilter.payment_date[Op.lte] = end_date;
        expenseDateFilter.entry_date[Op.lte] = end_date;
      }
    }

    // 1. Total Expenses
    const totalExpensesResult = await LedgerEntry.sum('amount', {
      where: {
        type: 'expense',
        ...expenseDateFilter
      }
    });
    const totalExpenses = parseFloat(totalExpensesResult || 0);

    // 2. Revenue Breakdown
    // Total Collected (All income)
    const totalCollectedResult = await Transaction.sum('amount', {
      where: {
        status: { [Op.notIn]: ['failed', 'cancelled'] }, // Exclude failed/cancelled
        ...dateFilter
      }
    });
    const totalCollected = parseFloat(totalCollectedResult || 0);

    // Membership Dues Only
    const totalMembershipCollectedResult = await Transaction.sum('amount', {
      where: {
        payment_type: 'membership_due',
        status: { [Op.notIn]: ['failed', 'cancelled'] },
        ...dateFilter
      }
    });
    const totalMembershipCollected = parseFloat(totalMembershipCollectedResult || 0);

    // Other Payments - Ensure not negative due to any async data issues, though calculated from same source
    const otherPayments = Math.max(totalCollected - totalMembershipCollected, 0);

    // 3. Net Income
    const netIncome = totalCollected - totalExpenses;

    // 4. Member Stats
    const totalMembers = await Member.count();

    // Contributing Members: distinct members who paid > 0 in period
    const contributingMembersCount = await Transaction.count({
      where: {
        amount: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['failed', 'cancelled'] },
        ...dateFilter
      },
      distinct: true,
      col: 'member_id'
    });

    // 5. Collection Rate & Outstanding
    // Based on Yearly Pledge vs Membership Collected
    const totalPledgeRaw = await Member.sum('yearly_pledge');
    const totalAmountDue = parseFloat(totalPledgeRaw || 0);

    // Outstanding = Pledges - Dues Collected (never negative)
    const outstandingAmount = Math.max(totalAmountDue - totalMembershipCollected, 0);

    // Collection Rate (Dues / Pledges)
    const collectionRate = totalAmountDue > 0
      ? ((totalMembershipCollected / totalAmountDue) * 100).toFixed(0)
      : '0';

    // 6. Up to Date vs Behind Calculation
    let upToDateMembers = 0;
    let behindMembers = 0;

    // To avoid fetching all members, we default to: 
    // "Up to Date" ~= Contributing Members (Approx)
    // "Behind" ~= Total Members - Contributing (Approx)
    // However, since we want to be accurate for Pledgers:

    const pledgedMembers = await Member.findAll({
      where: { yearly_pledge: { [Op.gt]: 0 } },
      attributes: ['id', 'yearly_pledge']
    });

    if (pledgedMembers.length > 0) {
      const pledgedMemberIds = pledgedMembers.map(m => m.id);

      const memberDues = await Transaction.findAll({
        where: {
          member_id: pledgedMemberIds,
          payment_type: 'membership_due',
          ...dateFilter
        },
        attributes: [
          'member_id',
          [sequelize.fn('SUM', sequelize.col('amount')), 'total']
        ],
        group: ['member_id'],
        raw: true
      });

      const duesMap = {};
      memberDues.forEach(d => { duesMap[d.member_id] = parseFloat(d.total); });

      // Prorate expectation based on current month of year
      const now = new Date();
      // If we are filtering by date, we might want to adjust expectation, but simple YTD is safer default
      const currentMonth = now.getMonth() + 1;
      const prorateFactor = currentMonth / 12.0;

      pledgedMembers.forEach(m => {
        const paid = duesMap[m.id] || 0;
        const totalPledge = parseFloat(m.yearly_pledge || 0);
        const expected = totalPledge * prorateFactor;

        // Allow $1 margin for float errors
        if (paid >= (expected - 1)) {
          upToDateMembers++;
        } else {
          behindMembers++;
        }
      });
    }

    // 7. Recent Bank Balance
    console.log('--- DEBUG: Fetching Bank Balance ---');
    const latestBankTxn = await BankTransaction.findOne({
      where: {
        balance: { [Op.ne]: null }
      },
      order: [['date', 'DESC'], ['id', 'DESC']],
      attributes: ['id', 'balance', 'date', ['created_at', 'createdAt']]
    });

    if (latestBankTxn) {
      console.log('--- DEBUG: Bank Transaction Found ---');
      console.log('ID:', latestBankTxn.id);
      console.log('Raw Balance:', latestBankTxn.balance);
      console.log('Date:', latestBankTxn.date);
      console.log('CreatedAt:', latestBankTxn.get('createdAt'));
    } else {
      console.log('--- DEBUG: No Bank Transaction Found ---');
    }

    const currentBankBalance = latestBankTxn && latestBankTxn.balance ? parseFloat(latestBankTxn.balance) : 0;
    const lastBankUpdate = latestBankTxn ? (latestBankTxn.get('createdAt') || latestBankTxn.date) : null;

    console.log('Calculated Current Balance:', currentBankBalance);
    console.log('Calculated Last Update:', lastBankUpdate);
    console.log('------------------------------------');

    const stats = {
      totalMembers,
      contributingMembers: contributingMembersCount,
      upToDateMembers,
      behindMembers,
      totalAmountDue,
      totalMembershipCollected,
      otherPayments,
      totalCollected,
      totalExpenses,
      netIncome,
      collectionRate,
      outstandingAmount,
      currentBankBalance,
      lastBankUpdate
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction statistics',
      error: error.message
    });
  }
};

// Get member payment summaries for the new system (aggregated by member)
const getMemberPaymentSummaries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Get all members first
    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      attributes: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'spouse_name',
        'monthly_payment'
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['first_name', 'ASC']]
    });

    // Get transaction summaries for each member
    const memberIds = members.map(member => member.id);
    const transactionSummaries = await Transaction.findAll({
      where: {
        member_id: memberIds
      },
      attributes: [
        'member_id',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalCollected'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'transactionCount']
      ],
      group: ['member_id'],
      raw: true
    });

    // Create a map for quick lookup
    const summaryMap = {};
    transactionSummaries.forEach(summary => {
      summaryMap[summary.member_id] = {
        totalCollected: parseFloat(summary.totalCollected || 0),
        transactionCount: parseInt(summary.transactionCount || 0)
      };
    });

    // Transform the data to match the expected format
    const summaries = members.map(member => {
      const stats = summaryMap[member.id] || { totalCollected: 0, transactionCount: 0 };

      // Calculate status based on monthly payment vs collected
      // This is a simplified logic - can be made more complex based on months passed
      const currentMonth = new Date().getMonth() + 1;
      const expectedTotal = (member.monthly_payment || 0) * currentMonth;

      let status = 'up_to_date';
      if (stats.totalCollected < expectedTotal) {
        status = 'behind';
      }
      if (stats.totalCollected === 0) {
        status = 'no_payment';
      }

      return {
        member: {
          id: member.id,
          firstName: member.first_name,
          lastName: member.last_name,
          email: member.email,
          phoneNumber: member.phone_number,
          spouseName: member.spouse_name
        },
        stats: {
          totalCollected: stats.totalCollected,
          transactionCount: stats.transactionCount,
          lastPaymentDate: null, // Would need another query or subquery for this
          status
        }
      };
    });

    res.json({
      success: true,
      data: {
        summaries,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching member payment summaries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member payment summaries',
      error: error.message
    });
  }
};

// Get skipped receipt numbers starting from a specific number
const getSkippedReceipts = async (req, res) => {
  try {
    const START_RECEIPT_NUMBER = parseInt(process.env.START_RECEIPT_NUMBER || '5680', 10);

    // Fetch all receipt numbers greater than or equal to the start number
    // We only care about numeric receipt numbers for this check
    const transactions = await Transaction.findAll({
      attributes: ['receipt_number'],
      where: {
        receipt_number: {
          [Op.not]: null
        }
      },
      raw: true
    });

    // Extract numeric receipt numbers
    const receiptNumbers = transactions
      .map(t => parseInt(t.receipt_number, 10))
      .filter(num => !isNaN(num) && num >= START_RECEIPT_NUMBER)
      .sort((a, b) => a - b);

    // Remove duplicates
    const uniqueReceiptNumbers = [...new Set(receiptNumbers)];

    if (uniqueReceiptNumbers.length === 0) {
      return res.json({
        success: true,
        data: {
          skippedReceipts: []
        }
      });
    }

    const skippedReceipts = [];
    const maxReceipt = uniqueReceiptNumbers[uniqueReceiptNumbers.length - 1];

    // Identify gaps
    // We iterate from known start number up to the max found number
    // If a number in that range doesn't exist in our sorted list, it's skipped
    const receiptSet = new Set(uniqueReceiptNumbers);
    for (let i = START_RECEIPT_NUMBER; i < maxReceipt; i++) {
      if (!receiptSet.has(i)) {
        skippedReceipts.push(i);
      }
    }

    res.json({
      success: true,
      data: {
        skippedReceipts,
        range: {
          start: START_RECEIPT_NUMBER,
          end: maxReceipt
        }
      }
    });

  } catch (error) {
    console.error('Error checking skipped receipts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check skipped receipts',
      error: error.message
    });
  }
};

// Patch: update only the payment_type of an existing transaction (admin/treasurer via routes)
// Restricted to Zelle transactions in this context
const updateTransactionPaymentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_type } = req.body || {};

    const allowed = ['membership_due', 'tithe', 'donation', 'event', 'offering', 'vow', 'building_fund', 'religious_item_sales', 'tigray_hunger_fundraiser', 'other'];
    if (!payment_type || !allowed.includes(payment_type)) {
      return res.status(400).json({ success: false, message: `Invalid payment_type. Allowed: ${allowed.join(', ')}` });
    }

    const tx = await Transaction.findByPk(id);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Scope to Zelle-only for now
    if (tx.payment_method !== 'zelle') {
      return res.status(400).json({ success: false, message: 'Only Zelle transactions can be updated via this endpoint' });
    }

    await tx.update({ payment_type });

    // Sync corresponding LedgerEntry
    try {
      const le = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
      if (le) {
        // Find new GL code mapping
        const freshCat = await IncomeCategory.findOne({ where: { payment_type_mapping: payment_type } });
        const glCode = freshCat?.gl_code || 'INC999';

        await le.update({
          type: payment_type,
          category: glCode,
          memo: `${glCode} - Zelle payment ${tx.external_id || tx.id}`
        });
        console.log(`✅ Synced ledger entry for transaction ${tx.id} to new type ${payment_type}`);
      }
    } catch (syncErr) {
      console.warn(`⚠️ Failed to sync ledger entry for transaction ${tx.id}:`, syncErr.message);
    }

    return res.json({ success: true, data: { id: tx.id, payment_type: tx.payment_type } });
  } catch (error) {
    console.error('Error updating transaction payment_type:', error);
    return res.status(500).json({ success: false, message: 'Failed to update payment_type', error: error.message });
  }
};

// Generate transaction-based reports for Treasurer > Reports
// Returns one of:
// - { success: true, data: { summary: { ... } } }
// - { success: true, data: { behindPayments: [ ... ] } }
// - { success: true, data: { monthlyTotals: { january: 0, ... } } }
const generateTransactionReport = async (req, res) => {
  try {
    const { reportType } = req.params; // 'summary' | 'behind_payments' | 'monthly_breakdown'

    if (reportType === 'summary') {
      // Reuse logic similar to getTransactionStats but wrap under data.summary
      const { start_date, end_date, payment_type } = req.query;
      const whereClause = {};
      if (start_date || end_date) {
        whereClause.payment_date = {};
        if (start_date) whereClause.payment_date[Op.gte] = start_date;
        if (end_date) whereClause.payment_date[Op.lte] = end_date;
      }
      if (payment_type) whereClause.payment_type = payment_type;

      const totalTransactions = await Transaction.count({ where: whereClause });
      const totalAmount = await Transaction.sum('amount', { where: whereClause });
      const totalMembers = await Member.count();
      const totalPledgeRaw = await Member.sum('yearly_pledge');
      const totalAmountDue = parseFloat(totalPledgeRaw || 0);
      const totalCollected = parseFloat(totalAmount || 0);
      const outstandingAmount = Math.max(totalAmountDue - totalCollected, 0);
      const collectionRate = totalAmountDue > 0
        ? ((totalCollected / totalAmountDue) * 100).toFixed(0)
        : '0';

      const summary = {
        totalMembers,
        upToDateMembers: 0,
        behindMembers: 0,
        totalAmountDue,
        totalCollected,
        collectionRate,
        outstandingAmount
      };

      return res.json({ success: true, data: { summary } });
    }

    if (reportType === 'behind_payments') {
      // Build a lightweight per-member aggregation to find those behind
      const members = await Member.findAll({
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'spouse_name', 'yearly_pledge']
      });

      const memberIds = members.map(m => m.id);
      const txSums = await Transaction.findAll({
        where: { member_id: memberIds, payment_type: 'membership_due' },
        attributes: [
          'member_id',
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalCollected']
        ],
        group: ['member_id'],
        raw: true
      });

      const collectedMap = {};
      txSums.forEach(r => { collectedMap[r.member_id] = parseFloat(r.totalCollected || 0); });

      const behindPayments = members
        .map(m => {
          const totalAmountDue = parseFloat(m.yearly_pledge || 0);
          const totalCollected = collectedMap[m.id] || 0;
          const balanceDue = Math.max(totalAmountDue - totalCollected, 0);
          return {
            id: m.id,
            memberName: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            totalAmountDue,
            totalCollected,
            balanceDue,
            member: {
              firstName: m.first_name || '',
              lastName: m.last_name || '',
              memberId: String(m.id),
              phoneNumber: m.phone_number || '',
              email: m.email || ''
            }
          };
        })
        .filter(x => x.balanceDue > 0)
        .sort((a, b) => b.balanceDue - a.balanceDue);

      return res.json({ success: true, data: { behindPayments } });
    }

    if (reportType === 'monthly_breakdown') {
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);

      const txs = await Transaction.findAll({
        where: { payment_date: { [Op.gte]: start, [Op.lte]: end } },
        attributes: ['id', 'amount', 'payment_date']
      });

      const monthlyTotals = {
        january: 0,
        february: 0,
        march: 0,
        april: 0,
        may: 0,
        june: 0,
        july: 0,
        august: 0,
        september: 0,
        october: 0,
        november: 0,
        december: 0
      };

      const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      for (const t of txs) {
        const d = new Date(t.payment_date);
        const idx = d.getMonth();
        const key = monthKeys[idx];
        monthlyTotals[key] += parseFloat(t.amount || 0);
      }

      return res.json({ success: true, data: { monthlyTotals } });
    }

    if (reportType === 'fundraiser') {
      const fundraiserTransactions = await Transaction.findAll({
        where: { payment_type: 'tigray_hunger_fundraiser' },
        include: [
          {
            model: Member,
            as: 'member',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'spouse_name'],
            include: [
              {
                model: Member,
                as: 'family_head',
                attributes: ['first_name', 'last_name']
              }
            ]
          }
        ],
        order: [['payment_date', 'DESC']]
      });

      const totalCollected = fundraiserTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

      return res.json({
        success: true,
        data: {
          fundraiser: {
            transactions: fundraiserTransactions,
            totalCollected
          }
        }
      });
    }

    return res.status(400).json({ success: false, message: `Unsupported report type: ${reportType}` });
  } catch (error) {
    console.error('Error generating transaction report:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
  }
};

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getMemberPaymentSummaries,
  getSkippedReceipts,
  updateTransactionPaymentType,
  generateTransactionReport
};