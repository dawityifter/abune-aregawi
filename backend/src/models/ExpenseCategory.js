'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ExpenseCategory extends Model {
    static associate(models) {
      // No associations for now
      // Future: Track who created/modified categories
    }
  }

  ExpenseCategory.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    gl_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        is: /^EXP\d{3}$/i // Must match pattern EXP001, EXP002, etc.
      },
      comment: 'General Ledger code (e.g., EXP001, EXP002)'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      },
      comment: 'Expense category name (e.g., Salary/Allowance, Mortgage)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the expense category'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this category is currently active'
    },
    is_fixed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this is a recurring/fixed expense'
    }
  }, {
    sequelize,
    modelName: 'ExpenseCategory',
    tableName: 'expense_categories',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['gl_code'], unique: true },
      { fields: ['is_active'] },
      { fields: ['is_fixed'] }
    ]
  });

  return ExpenseCategory;
};
