'use strict';

// Adds members.last_seen_at so the parish can answer "do members come back?" —
// a question the anonymous analytics deliberately cannot answer.
//
// Nullable with no default and no backfill: existing rows keep NULL, which reads
// correctly as "not seen since this shipped" rather than inventing a visit.

async function hasColumn(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return Object.prototype.hasOwnProperty.call(desc, column);
  } catch (_) {
    // Table missing (e.g. a fresh DB mid-bootstrap) — nothing to alter.
    return true;
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await hasColumn(queryInterface, 'members', 'last_seen_at')) return;
    await queryInterface.addColumn('members', 'last_seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last authenticated request from this member, throttled to hourly.'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('members', 'last_seen_at').catch(() => {});
  }
};
