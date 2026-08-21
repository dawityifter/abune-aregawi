'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Backed by a VIEW. Read-only: never call create/update/destroy on this model.
  class PledgeBalance extends Model {
    static associate(models) {
      PledgeBalance.belongsTo(models.Pledge, { foreignKey: 'pledge_id', as: 'pledge' });
      PledgeBalance.belongsTo(models.Member, { foreignKey: 'member_id', as: 'member' });
    }
  }

  PledgeBalance.init({
    pledge_id: { type: DataTypes.BIGINT, primaryKey: true },
    campaign_id: DataTypes.BIGINT,
    member_id: DataTypes.BIGINT,
    pledged_amount: DataTypes.DECIMAL(10, 2),
    paid_amount: DataTypes.DECIMAL(10, 2),
    remaining_amount: DataTypes.DECIMAL(10, 2),
    percent_fulfilled: DataTypes.DECIMAL(5, 1),
    derived_status: DataTypes.STRING(24),
    last_payment_at: DataTypes.DATEONLY
  }, {
    sequelize,
    modelName: 'PledgeBalance',
    tableName: 'pledge_balances',
    timestamps: false,
    underscored: true
  });

  // Backed by a VIEW, not a table. sequelize.sync({force:true}) normally
  // drops-then-creates a real table per registered model; many test files in
  // this suite call sync({force:true}) in their OWN beforeAll (in addition to
  // the one in tests/setup.js that already turned this name into a view), and
  // Sequelize's internal DROP TABLE fails against an existing SQL VIEW on both
  // SQLite and Postgres. Making sync()/drop() no-ops here means every later
  // sync() call in the same connection just leaves the view alone; the view
  // itself is only ever created/dropped via createPledgeViews/dropPledgeViews
  // in src/database/pledgeViews.js.
  PledgeBalance.sync = async () => PledgeBalance;
  PledgeBalance.drop = async () => true;

  return PledgeBalance;
};
