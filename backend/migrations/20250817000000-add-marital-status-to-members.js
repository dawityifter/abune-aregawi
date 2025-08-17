'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the enum type (Sequelize usually does this automatically when adding the column),
    // but being explicit helps avoid conflicts across environments.
    const enumTypeName = 'enum_members_marital_status';

    // Create enum type if it doesn't exist
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumTypeName}') THEN
          CREATE TYPE "${enumTypeName}" AS ENUM ('single', 'married', 'divorced', 'widowed');
        END IF;
      END$$;
    `);

    // Add column using the enum type
    await queryInterface.addColumn('members', 'marital_status', {
      type: Sequelize.ENUM('single', 'married', 'divorced', 'widowed'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the column first
    await queryInterface.removeColumn('members', 'marital_status');

    // Drop the enum type to keep schema clean
    const enumTypeName = 'enum_members_marital_status';
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumTypeName}') THEN
          DROP TYPE "${enumTypeName}";
        END IF;
      END$$;
    `);
  }
};
