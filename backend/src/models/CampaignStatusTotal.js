'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Backed by a VIEW. Read-only: never call create/update/destroy on this model.
  class CampaignStatusTotal extends Model {
    static associate(models) {
      CampaignStatusTotal.belongsTo(models.PledgeCampaign, {
        foreignKey: 'campaign_id', as: 'campaign'
      });
    }
  }

  CampaignStatusTotal.init({
    // Composite key: one row per campaign per derived status. Sequelize needs a
    // primary key to hydrate instances, and neither column is unique alone.
    campaign_id: { type: DataTypes.BIGINT, primaryKey: true },
    status: { type: DataTypes.STRING(24), primaryKey: true },
    pledge_count: DataTypes.INTEGER,
    household_count: DataTypes.INTEGER,
    total_pledged: DataTypes.DECIMAL(10, 2),
    total_collected: DataTypes.DECIMAL(10, 2),
    // Clamped at zero, and zero on the cancelled row — matching
    // campaign_totals.outstanding_positive. There is deliberately no `outstanding`
    // column here: that name belongs to the raw signed net, which this view does
    // not produce. One name per rule.
    outstanding_positive: DataTypes.DECIMAL(10, 2)
  }, {
    sequelize,
    modelName: 'CampaignStatusTotal',
    tableName: 'campaign_status_totals',
    timestamps: false,
    underscored: true
  });

  // Backed by a VIEW, not a table — see the matching comment in PledgeBalance.js
  // for why sync()/drop() must be no-ops here.
  CampaignStatusTotal.sync = async () => CampaignStatusTotal;
  CampaignStatusTotal.drop = async () => true;

  return CampaignStatusTotal;
};
