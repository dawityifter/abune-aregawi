'use strict';

// NOTE: no transaction wrapper. Postgres will not let a newly-added enum value
// be USED in the same transaction that adds it.
//
// BLOCKED: this migration intentionally does NOT insert an income_categories
// row for 'pledge_drive'. The brief specified gl_code 'INC010', but that code
// is already taken by 'Tigray Hunger Fundraiser' (see
// backend/src/database/seedIncomeCategories.js). Per the task brief's own
// instruction ("if INC010 is already taken there, STOP and report rather than
// guessing another"), the GL code assignment and the matching
// seedIncomeCategories.js entry are left for a follow-up once a real free code
// (likely 'INC011') is confirmed. The enum additions below are unaffected by
// that decision and are safe to ship on their own.

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    const { sequelize } = queryInterface;

    await sequelize.query('SET search_path TO public;');

    await sequelize.query(`
      ALTER TYPE enum_transactions_payment_type ADD VALUE IF NOT EXISTS 'pledge_drive';
    `);

    try {
      await sequelize.query(`
        ALTER TYPE enum_ledger_entries_type ADD VALUE IF NOT EXISTS 'pledge_drive';
      `);
    } catch (e) {
      console.log(`ℹ️  enum_ledger_entries_type not updated: ${e.message}`);
    }

    // income_categories row intentionally NOT inserted here — see note above.
  },

  down: async () => {
    // Postgres enum values are not removed on rollback — same precedent as
    // 20251231-add-tigray-fundraiser-payment-type.js.
    console.log('ℹ️  Down migration skipped for pledge_drive payment type.');
  }
};
