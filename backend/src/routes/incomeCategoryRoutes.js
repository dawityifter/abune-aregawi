const express = require('express');
const router = express.Router();
const {
  getAllIncomeCategories,
  getIncomeCategoryById,
  getIncomeCategoryByGLCode,
  createIncomeCategory,
  updateIncomeCategory,
  deleteIncomeCategory
} = require('../controllers/incomeCategoryController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Public route - get all active income categories (for dropdowns)
router.get('/', firebaseAuthMiddleware, getAllIncomeCategories);

// Get income category by ID
router.get('/:id', firebaseAuthMiddleware, getIncomeCategoryById);

// Get income category by GL code
router.get('/gl/:gl_code', firebaseAuthMiddleware, getIncomeCategoryByGLCode);

// Admin-only routes
router.post('/', firebaseAuthMiddleware, roleMiddleware(['admin', 'treasurer']), createIncomeCategory);
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(['admin', 'treasurer']), updateIncomeCategory);
router.delete('/:id', firebaseAuthMiddleware, roleMiddleware(['admin']), deleteIncomeCategory);

module.exports = router;
