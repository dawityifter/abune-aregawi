'use strict';

/**
 * Extend payment_type ENUM to include: building_fund, offering, vow
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create a new ENUM type with the extended set
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_church_transactions_payment_type'
        ) THEN
          CREATE TYPE "enum_church_transactions_payment_type" AS ENUM (
            'membership_due', 'tithe', 'donation', 'event', 'other'
          );
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_church_transactions_payment_type_new" AS ENUM (
          'membership_due', 'tithe', 'donation', 'event', 'building_fund', 'offering', 'vow', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Alter column to use the new ENUM type
    await queryInterface.sequelize.query(`
      ALTER TABLE church_transactions
      ALTER COLUMN payment_type TYPE "enum_church_transactions_payment_type_new"
      USING payment_type::text::"enum_church_transactions_payment_type_new";
    `);

    // Drop old type and rename new to old name to keep model/code stable
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_church_transactions_payment_type";
      ALTER TYPE "enum_church_transactions_payment_type_new" RENAME TO "enum_church_transactions_payment_type";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Recreate the original ENUM without the new values
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_church_transactions_payment_type_old" AS ENUM (
        'membership_due', 'tithe', 'donation', 'event', 'other'
      );
    `);

    // Coerce any rows with the new values back to 'other' to allow downgrade
    await queryInterface.sequelize.query(`
      UPDATE church_transactions
      SET payment_type = 'other'
      WHERE payment_type IN ('building_fund', 'offering', 'vow');
    `);

    // Switch column back to old ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE church_transactions
      ALTER COLUMN payment_type TYPE "enum_church_transactions_payment_type_old"
      USING payment_type::text::"enum_church_transactions_payment_type_old";
    `);

    // Replace current type with old
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_church_transactions_payment_type";
      ALTER TYPE "enum_church_transactions_payment_type_old" RENAME TO "enum_church_transactions_payment_type";
    `);
  }
};
