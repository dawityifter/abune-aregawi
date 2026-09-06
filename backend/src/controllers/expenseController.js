const { ExpenseCategory, LedgerEntry, BankTransaction, Member, Employee, Vendor, sequelize } = require('../models');
const { Op } = require('sequelize');
const tz = require('../config/timezone');
const { DEFAULT_START_CHECK_NUMBER, normalizeCheckNumber } = require('../utils/checkNumber');
const { isVoidMemo } = require('../utils/voidMemo');

// Check-method expenses must carry a unique check number. Enforcement is
// application-level (no DB constraint), so both the create and the update path
// have to run this — an edit that changes a check number would otherwise slip a
// duplicate past the check done at insert time.
// Returns { ok: true, value } or { ok: false, status, message }.
async function validateCheckNumber({ paymentMethod, checkNumber, excludeId = null }) {
  if (paymentMethod !== 'check') {
    // Cash expenses never keep a check number, so a method switch clears it.
    return { ok: true, value: null };
  }

  const normalized = normalizeCheckNumber(checkNumber);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      message: normalized.reason === 'empty'
        ? 'Check number is required for check payments'
        : 'Check number must be numeric (digits only, e.g. 1593)'
    };
  }
  const value = normalized.value;

  // Scoped to expenses: an incoming member check that happens to carry the same
  // number is a different physical check and must not block the church's own.
  const where = { type: 'expense', check_number: value };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await LedgerEntry.findOne({ where });
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: `Check number "${value}" has already been used. Please use a unique check number.`
    };
  }

  return { ok: true, value };
}

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

const ZERO_AMOUNT_MESSAGE =
  'Amount must be a positive number, or $0.00 for a check marked void in the memo';

/** Positive always; zero only when the memo marks the entry as a voided check. */
function isValidExpenseAmount(expenseAmount, memo) {
  if (!Number.isFinite(expenseAmount)) return false;
  if (expenseAmount > 0) return true;
  return expenseAmount === 0 && isVoidMemo(memo);
}

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

    // Validate required fields. Amount is compared explicitly rather than by
    // truthiness so a voided check's 0 still counts as supplied.
    const amountSupplied = amount !== undefined && amount !== null && amount !== '';
    if (!gl_code || !amountSupplied || !expense_date || !payment_method) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: gl_code, amount, expense_date, payment_method'
      });
    }

    // Validate amount. A voided check is the one expense worth $0.00: the check
    // number is spent and has to be on the books, but no money left the account.
    // The memo is what says so — see utils/voidMemo.
    const expenseAmount = parseFloat(amount);
    if (!isValidExpenseAmount(expenseAmount, memo)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: ZERO_AMOUNT_MESSAGE
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

    // Check number is required and must be unique for check payments
    const checkResult = await validateCheckNumber({
      paymentMethod: payment_method.toLowerCase(),
      checkNumber: check_number
    });
    if (!checkResult.ok) {
      await t.rollback();
      return res.status(checkResult.status).json({
        success: false,
        message: checkResult.message
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
        check_number: checkResult.value,
        invoice_number: invoice_number || null
      }, { transaction: t });
    } catch (ledgerError) {
      // This catch is here for a missing ledger_entries table during the
      // gradual migration. A validation error is a genuine rejection of the
      // row — swallowing it commits nothing while telling the treasurer the
      // expense was recorded, which loses the entry with no trace.
      if (ledgerError.name === 'SequelizeValidationError') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: ledgerError.errors?.[0]?.message || 'Invalid expense'
        });
      }
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

// Sort columns the expense list accepts, mapped to their ORDER BY clauses.
// A whitelist rather than interpolation: sort_by arrives straight from the
// query string and must never reach SQL as text.
//
// check_number is a string column holding digits, so plain text ordering would
// put "1000" before "999". Ordering by length first restores numeric order
// without a cast that would throw on the legacy non-numeric values still in the
// table. payee lives in three places depending on how the expense was entered.
const EXPENSE_SORT_COLUMNS = {
  entry_date: (dir) => [['entry_date', dir], ['created_at', dir]],
  category: (dir) => [['category', dir]],
  amount: (dir) => [['amount', dir]],
  payment_method: (dir) => [['payment_method', dir]],
  check_number: (dir) => [
    [sequelize.literal('LENGTH("LedgerEntry"."check_number")'), dir],
    ['check_number', dir]
  ],
  payee: (dir) => [
    [sequelize.literal('COALESCE("LedgerEntry"."payee_name", "vendor"."name", "employee"."last_name")'), dir]
  ]
};

const DEFAULT_EXPENSE_ORDER = [['entry_date', 'DESC'], ['created_at', 'DESC']];

// Mirrors the ledger_entries payment_method enum. Manual entry only allows cash
// and check, but bank reconciliation also writes ach, debit_card and other, so
// the filter has to cover everything that can reach the table.
const EXPENSE_PAYMENT_METHODS = [
  'cash', 'check', 'zelle', 'credit_card', 'debit_card', 'ach', 'other'
];

function buildExpenseOrder(sortBy, sortDir) {
  const build = EXPENSE_SORT_COLUMNS[sortBy];
  if (!build) return DEFAULT_EXPENSE_ORDER;

  const dir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return build(dir);
}

// Get all expenses with filtering and pagination
const getExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      start_date,
      end_date,
      gl_code,
      payee,
      payment_method,
      sort_by,
      sort_dir
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

    // Payment method filter. Whitelisted rather than passed through: the value
    // comes straight from the query string into a where clause.
    const methodFilter = String(payment_method || '').trim().toLowerCase();
    if (EXPENSE_PAYMENT_METHODS.includes(methodFilter)) {
      whereClause.payment_method = methodFilter;
    }

    // GL code filter
    if (gl_code) {
      whereClause.category = gl_code.toUpperCase();
    }

    // Payee filter (search across payee_name, employee name, and vendor name)
    if (payee) {
      whereClause[Op.or] = [
        { payee_name: { [Op.iLike]: `%${payee}%` } },
        { '$employee.first_name$': { [Op.iLike]: `%${payee}%` } },
        { '$employee.last_name$': { [Op.iLike]: `%${payee}%` } },
        { '$vendor.name$': { [Op.iLike]: `%${payee}%` } }
      ];
    }

    const { count, rows } = await LedgerEntry.findAndCountAll({
      where: whereClause,
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
          attributes: ['id', 'name', 'vendor_type']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: buildExpenseOrder(sort_by, sort_dir)
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
        category_description: category?.description || null,
        // external_id holds the bank transaction hash once a cleared bank row
        // has been linked to this expense.
        is_reconciled: Boolean(expenseData.external_id)
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

// The bank row an expense was reconciled against, for the details drawer.
//
// external_id holds the bank transaction's hash — the same link auto-reconcile
// writes when a cleared check is matched to a hand-entered expense. Fetched per
// request rather than joined into the list, since it is only read when someone
// opens one expense.
//
// amount_matches is computed here rather than in the UI: the bank stores a debit
// as negative and the expense stores it positive, so the comparison is on
// absolute values with a cent of tolerance. Getting that wrong in the UI would
// show a false mismatch on every reconciled row.
async function describeReconciliation(expense) {
  if (!expense.external_id) return null;

  const bankTxn = await BankTransaction.findOne({
    where: { transaction_hash: expense.external_id }
  });

  // A link with no row behind it: the bank transaction was deleted, or the
  // external_id came from somewhere other than a bank import. Report nothing
  // rather than failing the whole request.
  if (!bankTxn) return null;

  const bankAmount = Number(bankTxn.amount);
  return {
    id: bankTxn.id,
    date: bankTxn.date,
    description: bankTxn.description,
    amount: bankAmount,
    type: bankTxn.type,
    check_number: bankTxn.check_number,
    status: bankTxn.status,
    reconciled_source: bankTxn.reconciled_source,
    reconciled_at: bankTxn.reconciled_at,
    amount_matches: Math.abs(Math.abs(bankAmount) - Math.abs(Number(expense.amount))) < 0.005
  };
}

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
      category_description: category?.description || null,
      bank_transaction: await describeReconciliation(expense)
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
      memo,
      check_number,
      invoice_number
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
      // A $0.00 amount stays legal only for a voided check, judged against the
      // memo this edit leaves behind — the new one if the edit supplies it,
      // otherwise the one already on the row.
      const effectiveMemo = memo !== undefined ? memo : expense.memo;
      const expenseAmount = parseFloat(amount);
      if (!isValidExpenseAmount(expenseAmount, effectiveMemo)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: ZERO_AMOUNT_MESSAGE
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

    if (invoice_number !== undefined) {
      updateData.invoice_number = invoice_number || null;
    }

    // The request may change the method, the check number, or neither, so resolve
    // the effective values before validating. Always run this: switching to check
    // without supplying a number has to fail even when check_number is absent.
    const effectiveMethod = updateData.payment_method || expense.payment_method;
    const effectiveCheckNumber = check_number !== undefined ? check_number : expense.check_number;
    const checkResult = await validateCheckNumber({
      paymentMethod: effectiveMethod,
      checkNumber: effectiveCheckNumber,
      excludeId: expense.id
    });
    if (!checkResult.ok) {
      await t.rollback();
      return res.status(checkResult.status).json({
        success: false,
        message: checkResult.message
      });
    }
    updateData.check_number = checkResult.value;

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

// Answer "is this check number free?" for the Add Expense form, so a duplicate
// surfaces as the treasurer leaves the field rather than after a full submit.
// Same rules as validateCheckNumber, kept in one place by reusing its helper.
const getCheckNumberAvailability = async (req, res) => {
  try {
    const { check_number, exclude_id } = req.query;

    if (check_number === undefined || String(check_number).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'check_number is required'
      });
    }

    const normalized = normalizeCheckNumber(check_number);
    if (!normalized.ok) {
      return res.json({
        success: true,
        data: { check_number: null, available: false, reason: 'NON_NUMERIC' }
      });
    }

    const where = { type: 'expense', check_number: normalized.value };
    if (exclude_id) {
      where.id = { [Op.ne]: exclude_id };
    }

    const existing = await LedgerEntry.findOne({ where });

    res.json({
      success: true,
      data: {
        check_number: normalized.value,
        available: !existing,
        reason: existing ? 'DUPLICATE' : null
      }
    });
  } catch (error) {
    console.error('Error checking check number availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check check number availability',
      error: error.message
    });
  }
};

// The payment methods expenses actually use, so the filter never offers a
// choice that matches nothing. Derived rather than hardcoded: manual entry and
// bank reconciliation write different sets, and that will drift over time.
const getExpensePaymentMethods = async (req, res) => {
  try {
    const rows = await LedgerEntry.findAll({
      attributes: ['payment_method'],
      where: { type: 'expense' },
      group: ['payment_method'],
      raw: true
    });

    const methods = rows
      .map((row) => row.payment_method)
      .filter(Boolean)
      .sort();

    res.json({ success: true, data: methods });
  } catch (error) {
    console.error('Error fetching expense payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense payment methods',
      error: error.message
    });
  }
};

// Identify gaps in the check number sequence so the treasurer can audit the
// checkbook the same way skipped receipt numbers are audited on the payments side.
const getSkippedChecks = async (req, res) => {
  try {
    // Expenses only: the church's own checkbook. A check number on an income
    // entry is the number of a check a member wrote to the church, and counting
    // those here manufactures gaps across an unrelated numbering sequence.
    const rows = await LedgerEntry.findAll({
      attributes: ['check_number'],
      where: { type: 'expense', check_number: { [Op.ne]: null } },
      raw: true
    });

    // check_number is free text, so "CHK-1042", "#1042" and "1042" are the same
    // check. Strip everything that isn't a digit and parse what's left.
    let ignoredNonNumeric = 0;
    const numbers = [];
    for (const row of rows) {
      const digits = String(row.check_number).replace(/\D/g, '');
      if (!digits) {
        ignoredNonNumeric += 1;
        continue;
      }
      numbers.push(parseInt(digits, 10));
    }

    if (numbers.length === 0) {
      return res.json({
        success: true,
        data: { skippedChecks: [], range: null, ignoredNonNumeric }
      });
    }

    // The audit anchors at the first check of the current checkbook. Numbers
    // below it belong to a retired book and are not gaps to chase.
    const envStart = parseInt(process.env.START_CHECK_NUMBER, 10);
    const startCheck = Number.isFinite(envStart) ? envStart : DEFAULT_START_CHECK_NUMBER;

    const inRange = numbers.filter((n) => n >= startCheck);
    if (inRange.length === 0) {
      return res.json({
        success: true,
        data: { skippedChecks: [], range: null, ignoredNonNumeric }
      });
    }

    const checkSet = new Set(inRange);
    const maxCheck = Math.max(...inRange);

    const skippedChecks = [];
    for (let i = startCheck; i < maxCheck; i++) {
      if (!checkSet.has(i)) {
        skippedChecks.push(i);
      }
    }

    res.json({
      success: true,
      data: {
        skippedChecks,
        range: { start: startCheck, end: maxCheck },
        ignoredNonNumeric
      }
    });
  } catch (error) {
    console.error('Error checking skipped check numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check skipped check numbers',
      error: error.message
    });
  }
};

// Category-level expense report: monthly totals, a month x category matrix and
// the YTD category breakdown, including the bank debits nothing has classified.
//
// Deliberately separate from getExpenseStats, which reports the ledger alone.
// Every total here comes from one pass in expenseReportService so the sections
// cannot disagree with each other; see that file for what counts as an expense
// and why a manually entered expense and its cleared bank row are one number.
const getExpenseReport = async (req, res) => {
  try {
    const { buildExpenseReport } = require('../services/expenseReportService');
    const data = await buildExpenseReport(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error building expense report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to build expense report',
      error: error.message
    });
  }
};

// The individual transactions behind a report figure, from both the ledger and
// the unclassified bank debits, under the same filters the report used.
const getExpenseReportTransactions = async (req, res) => {
  try {
    const { listExpenseReportTransactions } = require('../services/expenseReportService');
    const { rows, total, pagination } = await listExpenseReportTransactions(req.query);
    res.json({ success: true, data: rows, total, pagination });
  } catch (error) {
    console.error('Error fetching expense report transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense report transactions',
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
  getExpenseStats,
  getExpenseReport,
  getExpenseReportTransactions,
  getSkippedChecks,
  getExpensePaymentMethods,
  getCheckNumberAvailability
};
