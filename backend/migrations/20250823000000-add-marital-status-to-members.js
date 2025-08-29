'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Idempotent: only add the column if it doesn't exist
    const table = await queryInterface.describeTable('members');
    if (!table.marital_status) {
      // Ensure enum type exists for Postgres (no-op otherwise)
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query(`DO $$ BEGIN
          CREATE TYPE "enum_members_marital_status" AS ENUM ('single','married','divorced','widowed');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;`);
      }

      await queryInterface.addColumn('members', 'marital_status', {
        type: Sequelize.ENUM('single', 'married', 'divorced', 'widowed'),
        allowNull: true,
      });
      console.log('✅ Added marital_status to members');
    } else {
      console.log('ℹ️ Skipped adding marital_status; column already exists');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Idempotent: only remove if exists
    const table = await queryInterface.describeTable('members');
    if (table.marital_status) {
      await queryInterface.removeColumn('members', 'marital_status');
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_members_marital_status\";");
      }
      console.log('♻️ Removed marital_status from members');
    } else {
      console.log('ℹ️ Skipped removing marital_status; column does not exist');
    }
  }
};
