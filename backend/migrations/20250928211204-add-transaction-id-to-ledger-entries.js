'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the missing account column
    await queryInterface.addColumn('ledger_entries', 'account', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'general',
      comment: 'The accounting account (e.g., cash, bank, income, expense)'
    });

    // Add index for the account column
    await queryInterface.addIndex('ledger_entries', ['account']);

    console.log('✅ Added account column and index to ledger_entries');
  },

  async down(queryInterface, Sequelize) {
    // Remove the index first
    await queryInterface.removeIndex('ledger_entries', 'ledger_entries_account');
    
    // Then remove the column
    await queryInterface.removeColumn('ledger_entries', 'account');

    console.log('✅ Removed account column and index from ledger_entries');
  },
};