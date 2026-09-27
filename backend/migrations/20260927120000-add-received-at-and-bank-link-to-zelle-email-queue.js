'use strict';

// Two additions to zelle_email_queue:
//
// email_received_at — the moment Gmail received the Zelle email. payment_date
// is the same instant cut to a Chicago date, so it cannot order payments that
// arrived on the same day; the Zelle Review screen sorts newest first on this.
//
// bank_transaction_id — the bank row this email's payment was confirmed
// against. Unique, so one bank row can never satisfy two emails. Nullable:
// set only once bank reconciliation pairs the two.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('zelle_email_queue');

    if (!table.email_received_at) {
      await queryInterface.addColumn('zelle_email_queue', 'email_received_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When Gmail received the email (Gmail internalDate)'
      });
    }

    if (!table.bank_transaction_id) {
      await queryInterface.addColumn('zelle_email_queue', 'bank_transaction_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'bank_transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Bank row this payment was confirmed against'
      });
    }

    const indexes = await queryInterface.showIndex('zelle_email_queue');
    const names = new Set(indexes.map((i) => i.name));
    if (!names.has('zelle_email_queue_bank_transaction_id_unique')) {
      await queryInterface.addIndex('zelle_email_queue', ['bank_transaction_id'], {
        name: 'zelle_email_queue_bank_transaction_id_unique',
        unique: true
      });
    }
    if (!names.has('zelle_email_queue_payment_date_received_at')) {
      await queryInterface.addIndex('zelle_email_queue', ['payment_date', 'email_received_at'], {
        name: 'zelle_email_queue_payment_date_received_at'
      });
    }
  },

  down: async (queryInterface) => {
    const indexes = await queryInterface.showIndex('zelle_email_queue');
    const names = new Set(indexes.map((i) => i.name));
    if (names.has('zelle_email_queue_payment_date_received_at')) {
      await queryInterface.removeIndex('zelle_email_queue', 'zelle_email_queue_payment_date_received_at');
    }
    if (names.has('zelle_email_queue_bank_transaction_id_unique')) {
      await queryInterface.removeIndex('zelle_email_queue', 'zelle_email_queue_bank_transaction_id_unique');
    }

    const table = await queryInterface.describeTable('zelle_email_queue');
    if (table.bank_transaction_id) await queryInterface.removeColumn('zelle_email_queue', 'bank_transaction_id');
    if (table.email_received_at) await queryInterface.removeColumn('zelle_email_queue', 'email_received_at');
  }
};
