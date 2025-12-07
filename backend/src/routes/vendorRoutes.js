const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { Vendor } = require('../models');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// All routes require authentication
router.use(firebaseAuthMiddleware);

/**
 * @route   GET /api/vendors
 * @desc    Get all vendors with optional filtering
 * @access  Private (treasurer, admin)
 */
router.get(
  '/',
  roleMiddleware(['treasurer', 'admin', 'church_leadership']),
  async (req, res) => {
    try {
      const { is_active, vendor_type } = req.query;

      const whereClause = {};
      if (is_active !== undefined) {
        whereClause.is_active = is_active === 'true';
      }
      if (vendor_type) {
        whereClause.vendor_type = vendor_type;
      }

      const vendors = await Vendor.findAll({
        where: whereClause,
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: vendors
      });
    } catch (error) {
      console.error('Error fetching vendors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch vendors',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/vendors/:id
 * @desc    Get vendor by ID
 * @access  Private (treasurer, admin)
 */
router.get(
  '/:id',
  roleMiddleware(['treasurer', 'admin', 'church_leadership']),
  async (req, res) => {
    try {
      const vendor = await Vendor.findByPk(req.params.id);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      res.json({
        success: true,
        data: vendor
      });
    } catch (error) {
      console.error('Error fetching vendor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch vendor',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/vendors
 * @desc    Create new vendor
 * @access  Private (admin)
 */
router.post(
  '/',
  roleMiddleware(['admin']),
  [
    body('name').trim().notEmpty().withMessage('Vendor name is required'),
    body('vendor_type').isIn(['utility', 'supplier', 'service-provider', 'contractor', 'lender', 'other']).withMessage('Invalid vendor type'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
    body('phone_number').optional().trim(),
    body('website').optional().isURL().withMessage('Invalid website URL')
  ],
  async (req, res) => {
    try {
      const vendor = await Vendor.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        data: vendor
      });
    } catch (error) {
      console.error('Error creating vendor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create vendor',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/vendors/:id
 * @desc    Update vendor
 * @access  Private (admin)
 */
router.put(
  '/:id',
  roleMiddleware(['admin']),
  async (req, res) => {
    try {
      const vendor = await Vendor.findByPk(req.params.id);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      await vendor.update(req.body);

      res.json({
        success: true,
        message: 'Vendor updated successfully',
        data: vendor
      });
    } catch (error) {
      console.error('Error updating vendor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update vendor',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/vendors/:id
 * @desc    Soft delete vendor
 * @access  Private (admin)
 */
router.delete(
  '/:id',
  roleMiddleware(['admin']),
  async (req, res) => {
    try {
      const vendor = await Vendor.findByPk(req.params.id);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      await vendor.destroy(); // Soft delete

      res.json({
        success: true,
        message: 'Vendor deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete vendor',
        error: error.message
      });
    }
  }
);

module.exports = router;
