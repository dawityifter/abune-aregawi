'use strict';

// Adds donor_name to transactions and ledger_entries so a gift from someone who
// is not a registered member can record WHO gave it. Until now the Square review
// screen's "anonymous" path wrote member_id = NULL and discarded the name
// entirely — there was no column to put it in.
//
// Nullable with no default and no backfill: existing rows keep NULL, which reads
// correctly as "donor not recorded".

async function hasColumn(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return Object.prototype.hasOwnProperty.call(desc, column);
  } catch (_) {
    // Table missing (e.g. a fresh DB mid-bootstrap) — nothing to alter.
    return true;
  }
}

const TABLES = ['transactions', 'ledger_entries'];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      if (await hasColumn(queryInterface, table, 'donor_name')) continue;
      await queryInterface.addColumn(table, 'donor_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Name of a non-member donor. Only set when member_id is null.'
      });
    }
  },

  down: async (queryInterface) => {
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, 'donor_name').catch(() => {});
    }
  }
};
