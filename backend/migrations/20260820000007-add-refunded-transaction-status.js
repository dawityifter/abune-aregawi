'use strict';

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_transactions_status ADD VALUE IF NOT EXISTS 'refunded';
    `);
  },

  down: async () => {
    console.log('ℹ️  Down migration skipped for refunded transaction status.');
  }
};
