const { Transaction, Member, LedgerEntry, IncomeCategory, sequelize } = require('../models');
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
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Add filters
    if (member_id) whereClause.member_id = member_id;
    if (payment_type) whereClause.payment_type = payment_type;
    if (payment_method) whereClause.payment_method = payment_method;
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
      donor_memo
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

    // If external_id provided, check for existing transaction
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
            donation_id: donation_id || transaction.donation_id,
            income_category_id: finalIncomeCategoryId
          }, { transaction: t }),
          
          // Update corresponding ledger entries
          LedgerEntry.destroy({ 
            where: { transaction_id: transaction.id },
            transaction: t 
          })
        ]);
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
        income_category_id: finalIncomeCategoryId
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
    const { start_date, end_date, payment_type } = req.query;
    const whereClause = {};

    if (start_date || end_date) {
      whereClause.payment_date = {};
      if (start_date) whereClause.payment_date[Op.gte] = start_date;
      if (end_date) whereClause.payment_date[Op.lte] = end_date;
    }

    if (payment_type) whereClause.payment_type = payment_type;

    // Get basic transaction stats
    const totalTransactions = await Transaction.count({ where: whereClause });
    const totalAmount = await Transaction.sum('amount', { where: whereClause });

    // Count ALL households/members, not just those with transactions
    const totalMembers = await Member.count();

    // Compute totals based on pledges and collections
    // Sum of all members' yearly pledges (null-safe)
    const totalPledgeRaw = await Member.sum('yearly_pledge');
    const totalAmountDue = parseFloat(totalPledgeRaw || 0);

    // Total collected from transactions (respecting any date/payment_type filters)
    const totalCollected = parseFloat(totalAmount || 0);

    // Outstanding = pledges - collected (never negative)
    const outstandingAmount = Math.max(totalAmountDue - totalCollected, 0);

    // Collection rate as percentage string (0-100)
    const collectionRate = totalAmountDue > 0
      ? ((totalCollected / totalAmountDue) * 100).toFixed(0)
      : '0';

    // Keep placeholders for member status counts until per-member calc is implemented
    const upToDateMembers = 0;
    const behindMembers = 0;

    const stats = {
      totalMembers,
      upToDateMembers,
      behindMembers,
      totalAmountDue,
      totalCollected,
      collectionRate,
      outstandingAmount
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
    const transformedMembers = members.map(member => {
      const summary = summaryMap[member.id] || { totalCollected: 0, transactionCount: 0 };
      const totalCollected = summary.totalCollected;
      const transactionCount = summary.transactionCount;
      
      // For the new system, we'll use a simplified approach
      // You might want to implement proper due calculation based on your business logic
      const monthlyPayment = parseFloat(member.monthly_payment || 0);
      const totalAmountDue = monthlyPayment * 12; // Annual dues
      const balanceDue = totalAmountDue - totalCollected;

      return {
        id: member.id,
        memberName: `${member.first_name} ${member.last_name}`,
        spouseName: member.spouse_name || '',
        phone1: member.phone_number || '',
        phone2: '', // Not available in new system
        totalAmountDue,
        totalCollected,
        balanceDue,
        monthlyPayment,
        paymentMethod: 'Mixed', // Since new system supports multiple methods
        member: {
          id: member.id,
          firstName: member.first_name,
          lastName: member.last_name,
          memberId: member.id.toString(),
          phoneNumber: member.phone_number,
          email: member.email
        }
      };
    });

    // Apply status filter if specified
    let filteredMembers = transformedMembers;
    if (status && status !== 'all') {
      filteredMembers = transformedMembers.filter(member => {
        const collected = member.totalCollected;
        const due = member.totalAmountDue;
        
        if (status === 'up_to_date') return collected >= due;
        if (status === 'behind') return collected < due && collected > 0;
        if (status === 'partial') return collected > 0 && collected < due;
        return true;
      });
    }

    res.json({
      success: true,
      data: filteredMembers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalMembers: count,
        hasNext: page * limit < count,
        hasPrev: page > 1
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

// Patch: update only the payment_type of an existing transaction (admin/treasurer via routes)
// Restricted to Zelle transactions in this context
const updateTransactionPaymentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_type } = req.body || {};

    const allowed = ['membership_due', 'tithe', 'donation', 'event', 'offering', 'vow', 'building_fund', 'religious_item_sales', 'other'];
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

      const monthKeys = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      for (const t of txs) {
        const d = new Date(t.payment_date);
        const idx = d.getMonth();
        const key = monthKeys[idx];
        monthlyTotals[key] += parseFloat(t.amount || 0);
      }

      return res.json({ success: true, data: { monthlyTotals } });
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
  updateTransactionPaymentType,
  generateTransactionReport
};