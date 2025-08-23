'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add marital_status column as ENUM
    await queryInterface.addColumn('members', 'marital_status', {
      type: Sequelize.ENUM('single', 'married', 'divorced', 'widowed'),
      allowNull: true,
    });

    console.log('✅ Added marital_status to members');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove marital_status column and ENUM type
    await queryInterface.removeColumn('members', 'marital_status');

    // Cleanup enum type in Postgres (only if using Postgres)
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_members_marital_status\";");
    }

    console.log('♻️ Removed marital_status from members');
  }
};
