'use strict';

/**
 * Converts members.interested_in_serving from BOOLEAN to ENUM('yes','no','maybe').
 * Mapping:
 *   - NULL  -> 'maybe'
 *   - TRUE  -> 'yes'
 *   - FALSE -> 'no'
 *
 * Down migration converts back to BOOLEAN:
 *   - 'yes'   -> TRUE
 *   - 'no'    -> FALSE
 *   - 'maybe' -> NULL
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ensure the enum type exists
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_members_interested_in_serving'
        ) THEN
          CREATE TYPE "enum_members_interested_in_serving" AS ENUM ('yes', 'no', 'maybe');
        END IF;
      END
      $$;
    `);

    // Convert BOOLEAN -> ENUM with explicit mapping
    await queryInterface.sequelize.query(`
      ALTER TABLE members 
      ALTER COLUMN interested_in_serving DROP DEFAULT,
      ALTER COLUMN interested_in_serving TYPE "enum_members_interested_in_serving"
      USING (
        CASE 
          WHEN interested_in_serving IS NULL THEN 'maybe'
          WHEN interested_in_serving = TRUE THEN 'yes'
          ELSE 'no'
        END::"enum_members_interested_in_serving"
      ),
      ALTER COLUMN interested_in_serving SET DEFAULT 'maybe';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Convert ENUM -> BOOLEAN with reverse mapping
    await queryInterface.sequelize.query(`
      ALTER TABLE members 
      ALTER COLUMN interested_in_serving DROP DEFAULT,
      ALTER COLUMN interested_in_serving TYPE BOOLEAN
      USING (
        CASE 
          WHEN interested_in_serving = 'yes' THEN TRUE
          WHEN interested_in_serving = 'no' THEN FALSE
          ELSE NULL
        END
      ),
      ALTER COLUMN interested_in_serving SET DEFAULT NULL;
    `);

    // Optionally drop the enum type (safe only if no other columns use it)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE udt_name = 'enum_members_interested_in_serving'
        ) THEN
          DROP TYPE IF EXISTS "enum_members_interested_in_serving";
        END IF;
      END
      $$;
    `);
  }
};
