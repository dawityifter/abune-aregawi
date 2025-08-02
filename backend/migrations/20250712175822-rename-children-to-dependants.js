'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the children table exists before trying to rename it
    try {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('children')) {
        await queryInterface.renameTable('children', 'dependants');
        console.log('✅ Renamed children table to dependants');
      } else if (tables.includes('dependants')) {
        console.log('ℹ️  dependants table already exists, skipping rename');
      } else {
        console.log('ℹ️  Neither children nor dependants table exists, skipping rename');
      }
    } catch (error) {
      console.log('ℹ️  Error checking tables, skipping rename:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check if the dependants table exists before trying to rename it back
    try {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('dependants')) {
        await queryInterface.renameTable('dependants', 'children');
        console.log('✅ Renamed dependants table back to children');
      } else if (tables.includes('children')) {
        console.log('ℹ️  children table already exists, skipping rename');
      } else {
        console.log('ℹ️  Neither dependants nor children table exists, skipping rename');
      }
    } catch (error) {
      console.log('ℹ️  Error checking tables, skipping rename:', error.message);
    }
  }
};
