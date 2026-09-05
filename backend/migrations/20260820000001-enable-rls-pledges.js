'use strict';

// `pledges` was missed by 20260811000000-enable-rls-square-expense-zelle-tables.js
// but holds the same class of data those tables do: names, emails, phones and
// addresses for every person who pledged. Same treatment, same reasoning —
// enable RLS, add no policies. Deny-all-to-non-owners blocks PostgREST's
// anon/authenticated roles; the backend connects as the table owner, and
// Postgres exempts owners from RLS unless FORCE is also set (it is not).

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize.query('ALTER TABLE public."pledges" ENABLE ROW LEVEL SECURITY;');
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize
      .query('ALTER TABLE public."pledges" DISABLE ROW LEVEL SECURITY;')
      .catch(() => {});
  }
};
