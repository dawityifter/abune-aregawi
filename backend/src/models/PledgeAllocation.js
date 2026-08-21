'use strict';

const { Model, DataTypes } = require('sequelize');

const SOURCES = ['stripe_auto', 'treasurer_manual', 'migration', 'stripe_refund'];

module.exports = (sequelize) => {
  // APPEND-ONLY. Rows are never updated or deleted — corrections are reversing
  // rows (negative amount + reverses_allocation_id + reason). That is what makes
  // the audit trail (who/when/previous/new/why) fall out of the table itself.
  // A Postgres trigger enforces this in production; the service layer must never
  // issue UPDATE or DELETE against this model.
  class PledgeAllocation extends Model {
    static associate(models) {
      PledgeAllocation.belongsTo(models.Pledge, { foreignKey: 'pledge_id', as: 'pledge' });
      PledgeAllocation.belongsTo(models.Transaction, { foreignKey: 'transaction_id', as: 'transaction' });
      PledgeAllocation.belongsTo(models.Member, { foreignKey: 'allocated_by', as: 'allocator' });
      PledgeAllocation.belongsTo(models.PledgeAllocation, {
        foreignKey: 'reverses_allocation_id', as: 'reverses'
      });
    }
  }

  PledgeAllocation.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    pledge_id: {
      type: DataTypes.BIGINT, allowNull: false,
      references: { model: 'pledges', key: 'id' }
    },
    transaction_id: {
      type: DataTypes.BIGINT, allowNull: false,
      references: { model: 'transactions', key: 'id' }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        notZero(value) {
          if (parseFloat(value) === 0) throw new Error('Allocation amount cannot be zero');
        }
      }
    },
    source: {
      type: DataTypes.STRING(24), allowNull: false,
      validate: { isIn: [SOURCES] }
    },
    allocated_by: {
      type: DataTypes.BIGINT, allowNull: true,
      references: { model: 'members', key: 'id' },
      comment: 'NULL only for automated sources (stripe_auto, stripe_refund)'
    },
    reason: { type: DataTypes.TEXT, allowNull: true },
    reverses_allocation_id: {
      type: DataTypes.BIGINT, allowNull: true,
      references: { model: 'pledge_allocations', key: 'id' }
    },
    idempotency_key: {
      type: DataTypes.STRING(191), allowNull: true, unique: true,
      comment: 'auto:<external_id>:<pledge_id> for automated allocations; NULL for manual'
    }
  }, {
    sequelize,
    modelName: 'PledgeAllocation',
    tableName: 'pledge_allocations',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,  // rows never change
    indexes: [
      { fields: ['pledge_id'] },
      { fields: ['transaction_id'] },
      { unique: true, fields: ['idempotency_key'] }
    ],
    validate: {
      reversalsAreNegativeAndExplained() {
        if (this.reverses_allocation_id == null) return;
        if (parseFloat(this.amount) >= 0) {
          throw new Error('A reversing allocation must have a negative amount');
        }
        if (!this.reason || !String(this.reason).trim()) {
          throw new Error('A reversing allocation must have a reason');
        }
      }
    }
  });

  PledgeAllocation.SOURCES = SOURCES;

  return PledgeAllocation;
};
