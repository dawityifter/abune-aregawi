'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class MemberLoan extends Model {
    static associate(models) {
      MemberLoan.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });

      MemberLoan.belongsTo(models.Member, {
        foreignKey: 'collected_by',
        as: 'collector'
      });

      MemberLoan.belongsTo(models.Transaction, {
        foreignKey: 'transaction_id',
        as: 'transaction'
      });
    }
  }

  MemberLoan.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    transaction_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'transactions',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    outstanding_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    receipt_number: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    loan_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'PARTIALLY_REPAID', 'CLOSED'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    collected_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'MemberLoan',
    tableName: 'member_loans',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return MemberLoan;
};
