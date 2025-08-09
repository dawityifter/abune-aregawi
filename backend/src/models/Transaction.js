'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Transaction extends Model {
    static associate(models) {
      // Define associations here
      Transaction.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
      
      Transaction.belongsTo(models.Member, {
        foreignKey: 'collected_by',
        as: 'collector'
      });
    }
  }

  Transaction.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    collected_by: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Date when the payment was made'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
        isPositive(value) {
          if (parseFloat(value) <= 0) {
            throw new Error('Amount must be greater than 0');
          }
        }
      },
      comment: 'Payment amount in dollars and cents'
    },
    payment_type: {
      type: DataTypes.ENUM('membership_due', 'tithe', 'donation', 'event', 'other'),
      allowNull: false,
      comment: 'Type of payment (membership dues, tithes, donations, etc.)'
    },
    payment_method: {
      type: DataTypes.ENUM('cash', 'check', 'zelle', 'credit_card', 'debit_card', 'ach', 'other'),
      allowNull: false,
      comment: 'Method of payment (cash, check, electronic, etc.)'
    },
    receipt_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Receipt number (required for cash and check payments)'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the payment'
    },
    external_id: {
      type: DataTypes.STRING(191),
      allowNull: true,
      comment: 'External payment reference (e.g., Stripe payment_intent id)'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Transaction',
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['member_id']
      },
      {
        fields: ['collected_by']
      },
      {
        fields: ['payment_date']
      },
      {
        fields: ['payment_type']
      },
      {
        fields: ['payment_method']
      },
      {
        unique: true,
        fields: ['external_id']
      }
    ],
    hooks: {
      beforeValidate: (transaction) => {
        // Ensure receipt_number is provided for cash and check payments
        if (['cash', 'check'].includes(transaction.payment_method) && !transaction.receipt_number) {
          throw new Error('Receipt number is required for cash and check payments');
        }
      }
    }
  });

  return Transaction;
}; 