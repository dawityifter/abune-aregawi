'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make email field optional
    await queryInterface.changeColumn('members', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });

    console.log('✅ Made email field optional');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert email field to required
    await queryInterface.changeColumn('members', 'email', {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true
    });

    console.log('✅ Reverted email field to required');
  }
}; 