'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add language_preference (nullable) to dependents
    await queryInterface.addColumn('dependents', 'language_preference', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove language_preference from dependents
    await queryInterface.removeColumn('dependents', 'language_preference');
  }
};
