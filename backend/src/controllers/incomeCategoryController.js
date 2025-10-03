const { IncomeCategory } = require('../models');
const { Op } = require('sequelize');

// Get all income categories
const getAllIncomeCategories = async (req, res) => {
  try {
    const { active_only = 'true' } = req.query;
    
    const whereClause = {};
    if (active_only === 'true') {
      whereClause.is_active = true;
    }

    const categories = await IncomeCategory.findAll({
      where: whereClause,
      order: [['display_order', 'ASC'], ['gl_code', 'ASC']]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching income categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income categories',
      error: error.message
    });
  }
};

// Get single income category by ID
const getIncomeCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await IncomeCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Income category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching income category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income category',
      error: error.message
    });
  }
};

// Get income category by GL code
const getIncomeCategoryByGLCode = async (req, res) => {
  try {
    const { gl_code } = req.params;

    const category = await IncomeCategory.findOne({
      where: { gl_code }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Income category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching income category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income category',
      error: error.message
    });
  }
};

// Create new income category (admin only)
const createIncomeCategory = async (req, res) => {
  try {
    const {
      gl_code,
      name,
      description,
      payment_type_mapping,
      is_active = true,
      display_order
    } = req.body;

    // Validate required fields
    if (!gl_code || !name) {
      return res.status(400).json({
        success: false,
        message: 'GL code and name are required'
      });
    }

    // Check if GL code already exists
    const existing = await IncomeCategory.findOne({
      where: { gl_code }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Income category with GL code ${gl_code} already exists`
      });
    }

    const category = await IncomeCategory.create({
      gl_code,
      name,
      description,
      payment_type_mapping,
      is_active,
      display_order
    });

    res.status(201).json({
      success: true,
      message: 'Income category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Error creating income category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create income category',
      error: error.message
    });
  }
};

// Update income category (admin only)
const updateIncomeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      payment_type_mapping,
      is_active,
      display_order
    } = req.body;

    const category = await IncomeCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Income category not found'
      });
    }

    // Update only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (payment_type_mapping !== undefined) updateData.payment_type_mapping = payment_type_mapping;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;

    await category.update(updateData);

    res.json({
      success: true,
      message: 'Income category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Error updating income category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update income category',
      error: error.message
    });
  }
};

// Delete income category (admin only - soft delete by setting is_active = false)
const deleteIncomeCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await IncomeCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Income category not found'
      });
    }

    // Soft delete by setting is_active to false
    await category.update({ is_active: false });

    res.json({
      success: true,
      message: 'Income category deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting income category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete income category',
      error: error.message
    });
  }
};

module.exports = {
  getAllIncomeCategories,
  getIncomeCategoryById,
  getIncomeCategoryByGLCode,
  createIncomeCategory,
  updateIncomeCategory,
  deleteIncomeCategory
};
