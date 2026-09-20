'use strict';

// Adds the 'event_merchandise' payment type and its income category.
//
// NOTE: no transaction wrapper, and the INSERT is a separate statement — same
// constraint as 20260820000006-add-pledge-drive-payment-type.js: Postgres will
// not let a newly-added enum value be USED in the transaction that adds it.
//
// Why a new type rather than reusing 'religious_item_sales' (INC009): that
// category is Bibles, candles and similar articles sold year-round from the
// church. Event merchandise is a fundraiser's own inventory, and the treasurer
// needs the two separable on a report without reading transaction notes.
//
// gl_code 'INC012': INC001-INC011 are all taken (see
// backend/src/database/seedIncomeCategories.js) and INC999 is the catch-all,
// so INC012 is the next free sequential code.

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    const { sequelize } = queryInterface;

    await sequelize.query('SET search_path TO public;');

    await sequelize.query(`
      ALTER TYPE enum_transactions_payment_type ADD VALUE IF NOT EXISTS 'event_merchandise';
    `);

    try {
      await sequelize.query(`
        ALTER TYPE enum_ledger_entries_type ADD VALUE IF NOT EXISTS 'event_merchandise';
      `);
    } catch (e) {
      console.log(`ℹ️  enum_ledger_entries_type not updated: ${e.message}`);
    }

    // Separate statement — the enum value added above is not usable until commit.
    await sequelize.query(`
      INSERT INTO income_categories (gl_code, name, description, payment_type_mapping, is_active, display_order, created_at, updated_at)
      SELECT 'INC012', 'Event Merchandise Sales',
             'Sales of merchandise at church events (e.g. fundraiser t-shirts). Not a charitable donation.',
             'event_merchandise', true, 12, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE gl_code = 'INC012');
    `);
  },

  down: async () => {
    // Postgres enum values are not removed on rollback — same precedent as
    // 20260820000006-add-pledge-drive-payment-type.js.
    console.log('ℹ️  Down migration skipped for event_merchandise payment type.');
  }
};
