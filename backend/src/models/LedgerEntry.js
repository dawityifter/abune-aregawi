'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class LedgerEntry extends Model {
    static associate(models) {
      // Define associations here
      LedgerEntry.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
      
      LedgerEntry.belongsTo(models.Member, {
        foreignKey: 'collected_by',
        as: 'collector'
      });
      
      LedgerEntry.belongsTo(models.Transaction, {
        foreignKey: 'transaction_id',
        as: 'transaction'
      });
      
      LedgerEntry.belongsTo(models.Employee, {
        foreignKey: 'employee_id',
        as: 'employee'
      });
      
      LedgerEntry.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id',
        as: 'vendor'
      });
    }
  }

  // Member ID type is BIGINT in both local and production
  const memberIdType = DataTypes.BIGINT;

  LedgerEntry.init({
    id: {
      type: DataTypes.BIGINT,  // Match production database schema
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    transaction_id: {
      type: DataTypes.BIGINT,
      allowNull: true, // Allow null for expense entries
      references: {
        model: 'transactions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    member_id: {
      type: memberIdType, // Dynamically set based on environment
      allowNull: true, // Can be null for non-member related entries
      references: {
        model: 'members',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    collected_by: {
      type: memberIdType, // Dynamically set based on environment
      allowNull: true, // Can be null for system-generated entries
      references: {
        model: 'members',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    entry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    type: {
      // DB uses a user-defined enum; map as string to avoid enum mismatch
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    fund: {
      // DB uses a user-defined enum; map as string
      type: DataTypes.STRING,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Transaction category (e.g., tithe, offering, donation)'
    },
    memo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    attachment_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    payment_method: {
      // DB uses a user-defined enum; map as string
      type: DataTypes.STRING,
      allowNull: true
    },
    receipt_number: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Check number, transaction ID, or other reference'
    },
    source_system: {
      // DB uses a user-defined enum; map as string, default 'manual'
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'manual'
    },
    external_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'External reference ID (e.g., from payment processor)'
    },
    statement_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Employee ID for salary/allowance expenses'
    },
    vendor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'vendors',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Vendor ID for vendor payments'
    },
    payee_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Generic payee name for expenses without employee/vendor'
    },
    check_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Check number if paid by check'
    },
    invoice_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Invoice or bill number'
    }
  }, {
    sequelize,
    modelName: 'LedgerEntry',
    tableName: 'ledger_entries',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['transaction_id'] },
      { fields: ['member_id'] },
      { fields: ['entry_date'] },
      { fields: ['category'] },
      { fields: ['external_id'], unique: true },
      { fields: ['employee_id'] },
      { fields: ['vendor_id'] }
    ]
  });

  return LedgerEntry;
};
