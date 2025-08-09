'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if columns already exist before adding them
    const tableDescription = await queryInterface.describeTable('dependents');
    
    if (!tableDescription.phone) {
      await queryInterface.addColumn('dependents', 'phone', {
        type: Sequelize.STRING(20),
        allowNull: true
      });
    }

    if (!tableDescription.email) {
      await queryInterface.addColumn('dependents', 'email', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    if (!tableDescription.baptism_name) {
      await queryInterface.addColumn('dependents', 'baptism_name', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }

    if (!tableDescription.is_baptized) {
      await queryInterface.addColumn('dependents', 'is_baptized', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    if (!tableDescription.baptism_date) {
      await queryInterface.addColumn('dependents', 'baptism_date', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }

    if (!tableDescription.name_day) {
      await queryInterface.addColumn('dependents', 'name_day', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('dependents', 'phone');
    await queryInterface.removeColumn('dependents', 'email');
    await queryInterface.removeColumn('dependents', 'baptism_name');
    await queryInterface.removeColumn('dependents', 'is_baptized');
    await queryInterface.removeColumn('dependents', 'baptism_date');
    await queryInterface.removeColumn('dependents', 'name_day');
  }
}; 