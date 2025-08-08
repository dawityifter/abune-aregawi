const { ChurchTransaction, Member } = require('../models');
const { Op } = require('sequelize');

// Get all church transactions with pagination and filtering
const getAllChurchTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, status, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // Search functionality
    if (search) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { description: { [Op.iLike]: `%${search}%` } },
          { type: { [Op.iLike]: `%${search}%` } },
          { status: { [Op.iLike]: `%${search}%` } }
        ]
      };
    }

    // Type filtering
    if (type) {
      whereClause.type = type;
    }

    // Status filtering
    if (status) {
      whereClause.status = status;
    }

    // Date range filtering
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at[Op.lte] = new Date(endDate);
      }
    }

    const transactions = await ChurchTransaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: Member,
          as: 'collected_by_member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: transactions.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(transactions.count / limit),
        totalItems: transactions.count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching church transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch church transactions' });
  }
};

// Get church transaction by ID
const getChurchTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await ChurchTransaction.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: Member,
          as: 'collected_by_member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Church transaction not found' });
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error fetching church transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch church transaction' });
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
      note
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

    const transaction = await ChurchTransaction.create({
      member_id,
      collected_by,
      payment_date: payment_date || new Date(),
      amount: parseFloat(amount),
      payment_type,
      payment_method,
      receipt_number,
      note
    });

    // Fetch the created transaction with associations
    const createdTransaction = await ChurchTransaction.findByPk(transaction.id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
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

    const transaction = await ChurchTransaction.findByPk(id);
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
    const updatedTransaction = await ChurchTransaction.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
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

    const transaction = await ChurchTransaction.findByPk(id);
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

// Get transaction statistics
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

    const stats = await ChurchTransaction.findAll({
      where: whereClause,
      attributes: [
        'payment_type',
        'payment_method',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
        [sequelize.fn('AVG', sequelize.col('amount')), 'average_amount']
      ],
      group: ['payment_type', 'payment_method'],
      order: [['payment_type', 'ASC'], ['payment_method', 'ASC']]
    });

    res.json({
      success: true,
      data: { stats }
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

module.exports = {
  getAllChurchTransactions,
  getChurchTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats
}; 