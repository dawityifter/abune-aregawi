'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add transaction_id column
    await queryInterface.addColumn('ledger_entries', 'transaction_id', {
      type: Sequelize.BIGINT,
      allowNull: true, // We'll set this to false after backfilling
      references: {
        model: 'transactions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    console.log('✅ Added transaction_id column to ledger_entries');

    // Add index for better performance
    await queryInterface.addIndex('ledger_entries', ['transaction_id']);
    console.log('✅ Added index on transaction_id');
  },

  async down(queryInterface, Sequelize) {
    // Remove the index first
    await queryInterface.removeIndex('ledger_entries', 'ledger_entries_transaction_id');
    console.log('✅ Removed transaction_id index');
    
    // Then remove the column
    await queryInterface.removeColumn('ledger_entries', 'transaction_id');
    console.log('✅ Removed transaction_id column');
  }
};
