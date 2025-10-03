'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class IncomeCategory extends Model {
    static associate(models) {
      // Define associations here
      IncomeCategory.hasMany(models.Transaction, {
        foreignKey: 'income_category_id',
        as: 'transactions'
      });
    }
  }

  IncomeCategory.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    gl_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'General Ledger code (e.g., INC001, INC002)'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Income category name'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the income category'
    },
    payment_type_mapping: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Maps to payment_type enum for backward compatibility (e.g., membership_due, offering)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this category is currently active'
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Order for displaying in dropdowns'
    }
  }, {
    sequelize,
    modelName: 'IncomeCategory',
    tableName: 'income_categories',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['gl_code']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['payment_type_mapping']
      }
    ]
  });

  return IncomeCategory;
};
