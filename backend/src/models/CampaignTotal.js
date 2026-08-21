'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Backed by a VIEW. Read-only: never call create/update/destroy on this model.
  class CampaignTotal extends Model {
    static associate(models) {
      CampaignTotal.belongsTo(models.PledgeCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
    }
  }

  CampaignTotal.init({
    campaign_id: { type: DataTypes.BIGINT, primaryKey: true },
    slug: DataTypes.STRING,
    goal_amount: DataTypes.DECIMAL(10, 2),
    pledge_count: DataTypes.INTEGER,
    donor_count: DataTypes.INTEGER,
    total_pledged: DataTypes.DECIMAL(10, 2),
    total_collected: DataTypes.DECIMAL(10, 2),
    outstanding: DataTypes.DECIMAL(10, 2),
    percent_to_goal: DataTypes.DECIMAL(5, 1)
  }, {
    sequelize,
    modelName: 'CampaignTotal',
    tableName: 'campaign_totals',
    timestamps: false,
    underscored: true
  });

  // Backed by a VIEW, not a table — see the matching comment in
  // PledgeBalance.js for why sync()/drop() must be no-ops here.
  CampaignTotal.sync = async () => CampaignTotal;
  CampaignTotal.drop = async () => true;

  return CampaignTotal;
};
