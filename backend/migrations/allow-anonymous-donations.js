'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('donations', 'donor_first_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.changeColumn('donations', 'donor_last_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.changeColumn('donations', 'donor_email', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes - make fields required again
    // Note: This might fail if there are existing null values
    await queryInterface.changeColumn('donations', 'donor_first_name', {
      type: Sequelize.STRING,
      allowNull: false
    });
    await queryInterface.changeColumn('donations', 'donor_last_name', {
      type: Sequelize.STRING,
      allowNull: false
    });
    await queryInterface.changeColumn('donations', 'donor_email', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
