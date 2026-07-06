'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS transactions_receipt_number_idx
      ON transactions (receipt_number)
      WHERE receipt_number IS NOT NULL AND receipt_number <> '000';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS transactions_receipt_number_idx;
    `);
  }
};
