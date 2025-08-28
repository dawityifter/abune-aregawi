const { Transaction, Member, sequelize } = require('../models');
const { Op } = require('sequelize');

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
    const memberInclude = {
      model: Member,
      as: 'member',
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
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
      memberInclude.required = true; // Ensure join filters results
    }

    const includes = [
      memberInclude,
      {
        model: Member,
        as: 'collector',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
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
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
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

// Create a new transaction
const createTransaction = async (req, res) => {
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
      status = 'succeeded',
      donation_id
    } = req.body;

    // Validate required fields
    if (!member_id || !collected_by || !amount || !payment_type || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: member_id, collected_by, amount, payment_type, payment_method'
      });
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Validate receipt number for cash/check payments
    if (['cash', 'check'].includes(payment_method) && !receipt_number) {
      return res.status(400).json({
        success: false,
        message: 'Receipt number is required for cash and check payments'
      });
    }

    // Verify that both member and collector exist
    const [member, collector] = await Promise.all([
      Member.findByPk(member_id),
      Member.findByPk(collected_by)
    ]);

    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (!collector) {
      return res.status(400).json({
        success: false,
        message: 'Collector not found'
      });
    }

    // If external_id provided, upsert to prevent duplicates
    let transaction = null;
    if (external_id) {
      const existing = await Transaction.findOne({ where: { external_id } });
      if (existing) {
        await existing.update({
          member_id,
          collected_by,
          payment_date: payment_date || new Date(),
          amount: parseFloat(amount),
          payment_type,
          payment_method,
          receipt_number,
          note,
          status,
          donation_id: donation_id || existing.donation_id
        });
        transaction = existing;
      }
    }

    if (!transaction) {
      transaction = await Transaction.create({
        member_id,
        collected_by,
        payment_date: payment_date || new Date(),
        amount: parseFloat(amount),
        payment_type,
        payment_method,
        receipt_number,
        note,
        external_id: external_id || null,
        status,
        donation_id: donation_id || null
      });
    }

    // Fetch the created transaction with associations
    const createdTransaction = await Transaction.findByPk(transaction.id, {
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
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: { transaction: createdTransaction }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message
    });
  }
};

// Update a transaction
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const transaction = await Transaction.findByPk(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Validate amount if provided
    if (updateData.amount && parseFloat(updateData.amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Validate receipt number for cash/check payments
    if (updateData.payment_method && ['cash', 'check'].includes(updateData.payment_method) && !updateData.receipt_number) {
      return res.status(400).json({
        success: false,
        message: 'Receipt number is required for cash and check payments'
      });
    }

    // Verify that both member and collector exist if they're being updated
    if (updateData.member_id) {
      const member = await Member.findByPk(updateData.member_id);
      if (!member) {
        return res.status(400).json({
          success: false,
          message: 'Member not found'
        });
      }
    }

    if (updateData.collected_by) {
      const collector = await Member.findByPk(updateData.collected_by);
      if (!collector) {
        return res.status(400).json({
          success: false,
          message: 'Collector not found'
        });
      }
    }

    await transaction.update(updateData);

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
      ]
    });

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: { transaction: updatedTransaction }
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: error.message
    });
  }
};

// Delete a transaction
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findByPk(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    await transaction.destroy();

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
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

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getMemberPaymentSummaries
}; 