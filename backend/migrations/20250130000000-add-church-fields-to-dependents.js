'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('dependents', 'phone', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await queryInterface.addColumn('dependents', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('dependents', 'baptism_name', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('dependents', 'is_baptized', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('dependents', 'baptism_date', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });

    await queryInterface.addColumn('dependents', 'name_day', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
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