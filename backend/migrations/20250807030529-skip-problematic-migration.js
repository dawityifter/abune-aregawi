'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('⏩ Marking problematic migration as completed...');
    
    // Mark the problematic migration as completed
    await queryInterface.sequelize.query(`
      INSERT INTO "SequelizeMeta" (name) 
      VALUES ('20250125000001-simple-refactor-to-bigint.js')
      ON CONFLICT (name) DO NOTHING;
    `);
    
    console.log('✅ Marked migration 20250125000001-simple-refactor-to-bigint.js as completed');
  },

  async down(queryInterface, Sequelize) {
    console.log('⏪ Reverting: Removing migration record...');
    
    // Remove the migration record if needed
    await queryInterface.sequelize.query(`
      DELETE FROM "SequelizeMeta" 
      WHERE name = '20250125000001-simple-refactor-to-bigint.js';
    `);
    
    console.log('✅ Removed migration record for 20250125000001-simple-refactor-to-bigint.js');
  }
};
