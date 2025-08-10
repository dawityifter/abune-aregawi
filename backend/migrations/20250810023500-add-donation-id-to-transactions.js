'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'transactions',
        'donation_id',
        {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'donations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'Optional FK to donations table for Stripe/audit linkage'
        },
        { transaction: t }
      );

      await queryInterface.addIndex('transactions', ['donation_id'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('transactions', ['donation_id'], { transaction: t });
      await queryInterface.removeColumn('transactions', 'donation_id', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};
