'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add repentance_father column
    await queryInterface.addColumn('members', 'repentance_father', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Name of the repentance father'
    });

    // Add household_size column
    await queryInterface.addColumn('members', 'household_size', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Number of people in the household'
    });

    console.log('✅ Added repentance_father and household_size columns');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the columns in reverse order
    await queryInterface.removeColumn('members', 'household_size');
    await queryInterface.removeColumn('members', 'repentance_father');
    
    console.log('✅ Removed repentance_father and household_size columns');
  }
}; 