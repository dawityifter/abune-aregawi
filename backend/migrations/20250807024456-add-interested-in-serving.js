'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Adding interested_in_serving column to members table...');
    
    // Add the new column
    await queryInterface.addColumn('members', 'interested_in_serving', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'Whether the member is interested in serving in ministries'
    });
    
    console.log('✅ Added interested_in_serving column to members table');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing interested_in_serving column from members table...');
    await queryInterface.removeColumn('members', 'interested_in_serving');
    console.log('✅ Removed interested_in_serving column from members table');
  }
};
