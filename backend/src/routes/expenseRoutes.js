const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { firebaseAuthMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(firebaseAuthMiddleware);

// Expense Categories
router.get('/categories', expenseController.getExpenseCategories);

// Expenses
router.post('/', expenseController.createExpense);
router.get('/', expenseController.getExpenses);
router.get('/stats', expenseController.getExpenseStats);
router.get('/:id', expenseController.getExpenseById);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense); // Admin only - will add middleware

module.exports = router;
