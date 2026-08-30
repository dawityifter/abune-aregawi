'use strict';

// Records who matched a Zelle email to a member, and when. The Gmail path no
// longer creates transactions — it only teaches payer->member associations
// that bank reconciliation later consumes — so the human decision needs its
// own audit trail, separate from processed_at (which the sync sets).

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('zelle_email_queue');

    if (!table.matched_by) {
      await queryInterface.addColumn('zelle_email_queue', 'matched_by', {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Member id of the treasurer/admin who made the match'
      });
    }

    if (!table.matched_at) {
      await queryInterface.addColumn('zelle_email_queue', 'matched_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('zelle_email_queue');
    if (table.matched_at) await queryInterface.removeColumn('zelle_email_queue', 'matched_at');
    if (table.matched_by) await queryInterface.removeColumn('zelle_email_queue', 'matched_by');
  }
};
