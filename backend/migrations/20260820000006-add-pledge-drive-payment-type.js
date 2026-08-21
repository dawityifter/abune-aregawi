'use strict';

// NOTE: no transaction wrapper. Postgres will not let a newly-added enum value
// be USED in the same transaction that adds it — hence the income_categories
// INSERT is a separate statement, issued after the ALTER TYPE calls above have
// implicitly committed.
//
// gl_code 'INC011' is used for the new "Pledge Drive" income category row.
// 'INC010' (the code originally proposed) is already taken by 'Tigray Hunger
// Fundraiser' in backend/src/database/seedIncomeCategories.js; INC001-INC010
// are all in use and INC999 is the "Other Income" catch-all, so INC011 is the
// next free sequential code (confirmed by the task coordinator).

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

    // Separate statement — the enum value added above is not usable until commit.
    await sequelize.query(`
      INSERT INTO income_categories (gl_code, name, description, payment_type_mapping, is_active, created_at, updated_at)
      SELECT 'INC011', 'Pledge Drive', 'Payments toward a pledge campaign', 'pledge_drive', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE gl_code = 'INC011');
    `);
  },

  down: async () => {
    // Postgres enum values are not removed on rollback — same precedent as
    // 20251231-add-tigray-fundraiser-payment-type.js.
    console.log('ℹ️  Down migration skipped for pledge_drive payment type.');
  }
};
