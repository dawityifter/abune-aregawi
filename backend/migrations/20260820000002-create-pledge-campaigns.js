'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pledge_campaigns', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      slug: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      name_ti: { type: Sequelize.STRING(255), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      description_ti: { type: Sequelize.TEXT, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      goal_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'usd' },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'draft' },
      default_payment_type: { type: Sequelize.STRING(50), allowNull: true },
      income_category_id: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'income_categories', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('pledge_campaigns', ['status']);

    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE pledge_campaigns
        ADD CONSTRAINT pledge_campaigns_status_check
        CHECK (status IN ('draft', 'active', 'closed'));
      `);
    }

    // Both campaigns start as draft. 2025 is frozen only after reconciliation
    // (see the spec, section 4.1) — you cannot reconcile a closed campaign.
    // 2026 is activated in a later phase.
    const now = new Date();
    await queryInterface.bulkInsert('pledge_campaigns', [
      {
        slug: '2025-pledge-drive', name: '2025 Pledge Drive',
        description: 'Pledge drive that ran September 2025 through January 2026.',
        start_date: '2025-09-13', end_date: '2026-01-12',
        currency: 'usd', status: 'draft', default_payment_type: 'building_fund',
        created_at: now, updated_at: now
      },
      {
        slug: '2026-pledge-drive', name: '2026 Pledge Drive',
        start_date: '2026-01-01', end_date: '2026-12-31',
        currency: 'usd', status: 'draft', default_payment_type: 'pledge_drive',
        created_at: now, updated_at: now
      }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pledge_campaigns');
  }
};
