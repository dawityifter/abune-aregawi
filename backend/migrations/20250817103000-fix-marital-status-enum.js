'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const enumTypeName = 'enum_members_marital_status';

    // Ensure enum type exists
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumTypeName}') THEN
          CREATE TYPE "${enumTypeName}" AS ENUM ('single');
        END IF;
      END$$;
    `);

    // Add all required values if missing
    const values = ['single', 'married', 'divorced', 'widowed'];
    for (const val of values) {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = '${enumTypeName}' AND e.enumlabel = '${val}'
          ) THEN
            ALTER TYPE "${enumTypeName}" ADD VALUE '${val}';
          END IF;
        END$$;
      `);
    }
  },

  async down() {
    // No-op: removing enum values is non-trivial and generally not needed
  }
};
