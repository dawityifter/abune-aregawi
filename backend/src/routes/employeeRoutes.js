const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { Employee } = require('../models');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// All routes require authentication
router.use(firebaseAuthMiddleware);

/**
 * @route   GET /api/employees
 * @desc    Get all employees with optional filtering
 * @access  Private (treasurer, admin)
 */
router.get(
  '/',
  roleMiddleware(['treasurer', 'admin']),
  async (req, res) => {
    try {
      const { is_active, employment_type } = req.query;
      
      const whereClause = {};
      if (is_active !== undefined) {
        whereClause.is_active = is_active === 'true';
      }
      if (employment_type) {
        whereClause.employment_type = employment_type;
      }

      const employees = await Employee.findAll({
        where: whereClause,
        order: [['last_name', 'ASC'], ['first_name', 'ASC']]
      });

      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employees',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/employees/:id
 * @desc    Get employee by ID
 * @access  Private (treasurer, admin)
 */
router.get(
  '/:id',
  roleMiddleware(['treasurer', 'admin']),
  async (req, res) => {
    try {
      const employee = await Employee.findByPk(req.params.id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/employees
 * @desc    Create new employee
 * @access  Private (admin)
 */
router.post(
  '/',
  roleMiddleware(['admin']),
  [
    body('first_name').trim().notEmpty().withMessage('First name is required'),
    body('last_name').trim().notEmpty().withMessage('Last name is required'),
    body('employment_type').isIn(['full-time', 'part-time', 'contract', 'volunteer']).withMessage('Invalid employment type'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
    body('phone_number').optional().trim(),
    body('position').optional().trim(),
    body('salary_amount').optional().isDecimal().withMessage('Salary must be a valid number'),
    body('salary_frequency').optional().isIn(['weekly', 'bi-weekly', 'monthly', 'annual', 'per-service'])
  ],
  async (req, res) => {
    try {
      const employee = await Employee.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: employee
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create employee',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee
 * @access  Private (admin)
 */
router.put(
  '/:id',
  roleMiddleware(['admin']),
  async (req, res) => {
    try {
      const employee = await Employee.findByPk(req.params.id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      await employee.update(req.body);

      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: employee
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update employee',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Soft delete employee
 * @access  Private (admin)
 */
router.delete(
  '/:id',
  roleMiddleware(['admin']),
  async (req, res) => {
    try {
      const employee = await Employee.findByPk(req.params.id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      await employee.destroy(); // Soft delete

      res.json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete employee',
        error: error.message
      });
    }
  }
);

module.exports = router;
