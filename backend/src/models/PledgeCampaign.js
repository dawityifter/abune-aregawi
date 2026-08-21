'use strict';

const { Model, DataTypes } = require('sequelize');

const STATUSES = ['draft', 'active', 'closed'];

module.exports = (sequelize) => {
  class PledgeCampaign extends Model {
    static associate(models) {
      PledgeCampaign.hasMany(models.Pledge, { foreignKey: 'campaign_id', as: 'pledges' });
      PledgeCampaign.belongsTo(models.IncomeCategory, {
        foreignKey: 'income_category_id', as: 'incomeCategory'
      });
    }

    get isOpen() {
      return this.status !== 'closed';
    }
  }

  PledgeCampaign.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    name_ti: { type: DataTypes.STRING(255), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    description_ti: { type: DataTypes.TEXT, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    goal_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'usd' },
    // VARCHAR + validation rather than a Postgres ENUM: LedgerEntry sets the
    // precedent (enums mapped as STRING to avoid enum mismatch), and it spares
    // us the CREATE TYPE/swap/rename dance on every future status addition.
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'draft',
      validate: { isIn: [STATUSES] }
    },
    default_payment_type: { type: DataTypes.STRING(50), allowNull: true },
    income_category_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'income_categories', key: 'id' }
    }
  }, {
    sequelize,
    modelName: 'PledgeCampaign',
    tableName: 'pledge_campaigns',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  PledgeCampaign.STATUSES = STATUSES;

  return PledgeCampaign;
};
