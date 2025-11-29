const { ExpenseCategory, LedgerEntry, Member, Employee, Vendor, sequelize } = require('../models');
const { Op } = require('sequelize');
const tz = require('../config/timezone');

// Get all expense categories (active only by default)
const getExpenseCategories = async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    const whereClause = {};
    if (include_inactive !== 'true') {
      whereClause.is_active = true;
    }

    const categories = await ExpenseCategory.findAll({
      where: whereClause,
      order: [['gl_code', 'ASC']]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense categories',
      error: error.message
    });
  }
};

// Create a new expense
const createExpense = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const {
      gl_code,
      amount,
      expense_date,
      payment_method,
      receipt_number,
      memo,
      employee_id,
      vendor_id,
      payee_name,
      check_number,
      invoice_number
    } = req.body;

    // Validate required fields
    if (!gl_code || !amount || !expense_date || !payment_method) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: gl_code, amount, expense_date, payment_method'
      });
    }

    // Validate amount
    const expenseAmount = parseFloat(amount);
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Validate payment method (only cash and check for now)
    if (!['cash', 'check'].includes(payment_method.toLowerCase())) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either "cash" or "check"'
      });
    }

    // Validate GL code exists and is active
    const category = await ExpenseCategory.findOne({
      where: {
        gl_code: gl_code.toUpperCase(),
        is_active: true
      }
    });

    if (!category) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive GL code: ${gl_code}`
      });
    }

    // Validate expense date is not in the future
    const expDate = tz.parseDate(expense_date);
    const today = tz.endOfDay();
    
    if (expDate > today) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Expense date cannot be in the future'
      });
    }

    // Get collector (the logged-in user)
    const collected_by = req.user?.id;
    if (!collected_by) {
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Create ledger entry for expense (optional - wrapped for gradual migration)
    let ledgerEntry = null;
    try {
      ledgerEntry = await LedgerEntry.create({
        type: 'expense',
        category: category.gl_code,
        amount: expenseAmount,
        entry_date: expense_date,
        payment_method: payment_method.toLowerCase(),
        receipt_number: receipt_number || null,
        memo: memo || `${category.name} expense`,
        collected_by,
        member_id: null, // Expenses don't have associated members
        transaction_id: null, // Expenses don't create transactions
        source_system: 'manual',
        external_id: null,
        fund: null,
        attachment_url: null,
        statement_date: null,
        employee_id: employee_id || null,
        vendor_id: vendor_id || null,
        payee_name: payee_name || null,
        check_number: check_number || null,
        invoice_number: invoice_number || null
      }, { transaction: t });
    } catch (ledgerError) {
      console.warn('⚠️  Could not create ledger entry:', ledgerError.message);
    }

    await t.commit();

    // Fetch the created expense with category details (if ledger entry was created)
    let result;
    if (ledgerEntry) {
      const expenseWithCategory = await LedgerEntry.findByPk(ledgerEntry.id, {
        include: [
          {
            model: Member,
            as: 'collector',
            attributes: ['id', 'first_name', 'last_name', 'email']
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'first_name', 'last_name', 'position']
          },
          {
            model: Vendor,
            as: 'vendor',
            attributes: ['id', 'name', 'vendor_type', 'contact_person']
          }
        ]
      });

      // Add category info manually (since it's not a direct association)
      result = {
        ...expenseWithCategory.toJSON(),
        category_name: category.name,
        category_description: category.description
      };
    } else {
      // If ledger entry failed, still return success with category info
      result = {
        category_name: category.name,
        category_description: category.description,
        note: 'Expense recorded but ledger entry not created (ledger_entries table may not exist)'
      };
    }

    res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      data: result
    });
  } catch (error) {
    await t.rollback();
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense',
      error: error.message
    });
  }
};

// Get all expenses with filtering and pagination
const getExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      start_date,
      end_date,
      gl_code,
      payment_method
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { type: 'expense' };

    // Date range filter
    if (start_date || end_date) {
      whereClause.entry_date = {};
      if (start_date) {
        whereClause.entry_date[Op.gte] = start_date;
      }
      if (end_date) {
        whereClause.entry_date[Op.lte] = end_date;
      }
    }

    // GL code filter
    if (gl_code) {
      whereClause.category = gl_code.toUpperCase();
    }

    // Payment method filter
    if (payment_method) {
      whereClause.payment_method = payment_method.toLowerCase();
    }

    const { count, rows } = await LedgerEntry.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['entry_date', 'DESC'], ['created_at', 'DESC']]
    });

    // Fetch all unique GL codes from the results to get category names
    const glCodes = [...new Set(rows.map(r => r.category))];
    const categories = await ExpenseCategory.findAll({
      where: { gl_code: { [Op.in]: glCodes } }
    });

    const categoryMap = new Map(categories.map(c => [c.gl_code, c]));

    // Enrich expenses with category details
    const enrichedExpenses = rows.map(expense => {
      const expenseData = expense.toJSON();
      const category = categoryMap.get(expense.category);
      return {
        ...expenseData,
        category_name: category?.name || 'Unknown',
        category_description: category?.description || null
      };
    });

    res.json({
      success: true,
      data: enrichedExpenses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses',
      error: error.message
    });
  }
};

// Get single expense by ID
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await LedgerEntry.findOne({
      where: {
        id,
        type: 'expense'
      },
      include: [
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // Get category details
    const category = await ExpenseCategory.findOne({
      where: { gl_code: expense.category }
    });

    const result = {
      ...expense.toJSON(),
      category_name: category?.name || 'Unknown',
      category_description: category?.description || null
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense',
      error: error.message
    });
  }
};

// Update an expense
const updateExpense = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      gl_code,
      amount,
      expense_date,
      payment_method,
      receipt_number,
      memo
    } = req.body;

    // Find the expense
    const expense = await LedgerEntry.findOne({
      where: {
        id,
        type: 'expense'
      },
      transaction: t
    });

    if (!expense) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    // Build update object with only provided fields
    const updateData = {};

    if (gl_code) {
      // Validate new GL code
      const category = await ExpenseCategory.findOne({
        where: {
          gl_code: gl_code.toUpperCase(),
          is_active: true
        }
      });

      if (!category) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid or inactive GL code: ${gl_code}`
        });
      }
      updateData.category = category.gl_code;
    }

    if (amount !== undefined) {
      const expenseAmount = parseFloat(amount);
      if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
      }
      updateData.amount = expenseAmount;
    }

    if (expense_date) {
      const expDate = new Date(expense_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (expDate > today) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Expense date cannot be in the future'
        });
      }
      updateData.entry_date = expense_date;
    }

    if (payment_method) {
      if (!['cash', 'check'].includes(payment_method.toLowerCase())) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Payment method must be either "cash" or "check"'
        });
      }
      updateData.payment_method = payment_method.toLowerCase();
    }

    if (receipt_number !== undefined) {
      updateData.receipt_number = receipt_number || null;
    }

    if (memo !== undefined) {
      updateData.memo = memo || null;
    }

    // Update the expense
    await expense.update(updateData, { transaction: t });
    await t.commit();

    // Fetch updated expense with details
    const updatedExpense = await LedgerEntry.findByPk(expense.id, {
      include: [
        {
          model: Member,
          as: 'collector',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    // Get category details
    const category = await ExpenseCategory.findOne({
      where: { gl_code: updatedExpense.category }
    });

    const result = {
      ...updatedExpense.toJSON(),
      category_name: category?.name || 'Unknown',
      category_description: category?.description || null
    };

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: result
    });
  } catch (error) {
    await t.rollback();
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error.message
    });
  }
};

// Delete an expense (Admin only)
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await LedgerEntry.findOne({
      where: {
        id,
        type: 'expense'
      }
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    await expense.destroy();

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error.message
    });
  }
};

// Get expense statistics
const getExpenseStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    // Total expenses for the year
    const totalExpensesResult = await LedgerEntry.sum('amount', {
      where: {
        type: 'expense',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      }
    });
    const totalExpenses = parseFloat(totalExpensesResult) || 0;

    // Expense count
    const expenseCount = await LedgerEntry.count({
      where: {
        type: 'expense',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      }
    });

    // Average expense
    const averageExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

    // Expenses by category
    const expensesByGLCode = await LedgerEntry.findAll({
      where: {
        type: 'expense',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      },
      attributes: [
        'category',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category'],
      raw: true
    });

    // Get category names
    const glCodes = expensesByGLCode.map(e => e.category);
    const categories = await ExpenseCategory.findAll({
      where: { gl_code: { [Op.in]: glCodes } }
    });
    const categoryMap = new Map(categories.map(c => [c.gl_code, c]));

    const byCategory = expensesByGLCode.map(e => ({
      gl_code: e.category,
      name: categoryMap.get(e.category)?.name || 'Unknown',
      total: parseFloat(e.total) || 0,
      count: parseInt(e.count) || 0
    }));

    // Expenses by month
    const byMonth = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      const monthTotal = await LedgerEntry.sum('amount', {
        where: {
          type: 'expense',
          entry_date: { [Op.gte]: monthStart, [Op.lte]: monthEnd }
        }
      });

      byMonth.push({
        month: month + 1,
        monthName: monthStart.toLocaleString('default', { month: 'long' }),
        total: parseFloat(monthTotal) || 0
      });
    }

    // Expenses by payment method
    const byPaymentMethodData = await LedgerEntry.findAll({
      where: {
        type: 'expense',
        entry_date: { [Op.gte]: start, [Op.lte]: end }
      },
      attributes: [
        'payment_method',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['payment_method'],
      raw: true
    });

    const byPaymentMethod = {};
    byPaymentMethodData.forEach(item => {
      byPaymentMethod[item.payment_method] = parseFloat(item.total) || 0;
    });

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        expenseCount,
        averageExpense: Number(averageExpense.toFixed(2)),
        byCategory,
        byMonth,
        byPaymentMethod
      }
    });
  } catch (error) {
    console.error('Error fetching expense stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense statistics',
      error: error.message
    });
  }
};

module.exports = {
  getExpenseCategories,
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseStats
};
