'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Adding interested_in_serving ENUM column to members table...');
    
    // First create the enum type
    await queryInterface.sequelize.query(
      "CREATE TYPE \"enum_members_interested_in_serving\" AS ENUM ('yes', 'no', 'maybe')"
    );
    
    // Then add the column with default value
    await queryInterface.addColumn('members', 'interested_in_serving', {
      type: 'VARCHAR(10)', // Sequelize will use the enum type we created
      allowNull: true,
      defaultValue: 'maybe',
      comment: 'Whether the member is interested in serving in ministries',
      // For PostgreSQL, we need to set the column to use our enum type
      // This is done in a separate query after adding the column
    });
    
    // Set the column to use our enum type
    await queryInterface.sequelize.query(
      'ALTER TABLE members ALTER COLUMN interested_in_serving TYPE "enum_members_interested_in_serving" ' +
      'USING (interested_in_serving::"enum_members_interested_in_serving")'
    );
    
    console.log('✅ Added interested_in_serving ENUM column to members table');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing interested_in_serving column from members table...');
    
    // First remove the column
    await queryInterface.removeColumn('members', 'interested_in_serving');
    
    // Then drop the enum type
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_members_interested_in_serving"'
    );
    
    console.log('✅ Removed interested_in_serving column and enum type');
  }
};
