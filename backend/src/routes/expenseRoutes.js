const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// All routes require authentication
router.use(firebaseAuthMiddleware);

// Define role groups
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary', 'bookkeeper', 'auditor', 'budget_committee', 'ap_team']; // Can view expenses
const editRoles = ['admin', 'treasurer', 'bookkeeper', 'ap_team']; // Can create/edit expenses
const deleteRoles = ['admin']; // Can delete expenses

// Expense Categories (READ-ONLY)
router.get('/categories', roleMiddleware(viewRoles), expenseController.getExpenseCategories);

// Get expense statistics (READ-ONLY)
router.get('/stats', roleMiddleware(viewRoles), expenseController.getExpenseStats);

// Get all expenses (READ-ONLY)
router.get('/', roleMiddleware(viewRoles), expenseController.getExpenses);

// Get single expense by ID (READ-ONLY)
router.get('/:id', roleMiddleware(viewRoles), expenseController.getExpenseById);

// Create expense (WRITE - treasurer/admin only)
router.post('/', roleMiddleware(editRoles), expenseController.createExpense);

// Update expense (WRITE - treasurer/admin only)
router.put('/:id', roleMiddleware(editRoles), expenseController.updateExpense);

// Delete expense (DELETE - admin only)
router.delete('/:id', roleMiddleware(deleteRoles), expenseController.deleteExpense);

module.exports = router;
