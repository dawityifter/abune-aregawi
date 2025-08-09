'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add external_id column if it doesn't exist
    await queryInterface.addColumn('transactions', 'external_id', {
      type: Sequelize.STRING(191),
      allowNull: true,
      comment: 'External payment reference (e.g., Stripe payment_intent id)'
    }).catch(() => {});

    // Add unique index on external_id
    try {
      await queryInterface.addIndex('transactions', ['external_id'], {
        unique: true,
        name: 'transactions_external_id_unique'
      });
    } catch (_) {
      // ignore if exists
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove unique index then column
    try {
      await queryInterface.removeIndex('transactions', 'transactions_external_id_unique');
    } catch (_) {}

    await queryInterface.removeColumn('transactions', 'external_id').catch(() => {});
  }
};
