'use strict';

// Enforces "one expense per check number" in the database, not just in
// application code.
//
// Two paths write expense ledger entries directly (expenseController and the
// bank reconciliation service), and both had to remember to run the duplicate
// check themselves. One of them didn't, for a long time. A constraint removes
// the possibility rather than relying on every future write path remembering.
//
// Deliberately partial:
//   - type = 'expense'      an incoming member check may legitimately carry the
//                           same number as one of the church's own; they are
//                           different physical checks.
//   - check_number NOT NULL  cash expenses and unnumbered legacy rows must
//                           still be allowed, and many of them exist.
//
// Postgres only. sqlite (used by the test suite) has partial indexes too, but
// the index is a production data-integrity guarantee and the suite asserts the
// application-level rules instead, so there is nothing to gain from creating it
// there.
//
// Verified against a production snapshot before writing this: the duplicate
// query returned no rows. If that has changed by the time this runs, the
// migration fails loudly and the deploy stops — which is the correct outcome,
// because silently keeping duplicates would defeat the point. To find them:
//
//   SELECT check_number, COUNT(*) FROM ledger_entries
//   WHERE type = 'expense' AND check_number IS NOT NULL
//   GROUP BY check_number HAVING COUNT(*) > 1;

const INDEX_NAME = 'ledger_entries_expense_check_number_unique';

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX_NAME}"
      ON public."ledger_entries" (check_number)
      WHERE type = 'expense' AND check_number IS NOT NULL;
    `);
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS public."${INDEX_NAME}";`);
  }
};
