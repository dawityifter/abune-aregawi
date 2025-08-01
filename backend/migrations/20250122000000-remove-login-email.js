'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('members', 'login_email');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('members', 'login_email', {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    });
  }
}; 