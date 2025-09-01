'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop name_day column if it exists
    const table = await queryInterface.describeTable('dependents');
    if (table.name_day) {
      await queryInterface.removeColumn('dependents', 'name_day');
    }
  },

  async down(queryInterface, Sequelize) {
    // Re-create name_day column if it does not exist
    const table = await queryInterface.describeTable('dependents');
    if (!table.name_day) {
      await queryInterface.addColumn('dependents', 'name_day', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  }
};
