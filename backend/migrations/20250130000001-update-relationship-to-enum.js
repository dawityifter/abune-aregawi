'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, create the ENUM type
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_dependents_relationship" AS ENUM ('Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Other');
    `);

    // Update existing relationship values to match the ENUM
    await queryInterface.sequelize.query(`
      UPDATE dependents 
      SET relationship = 'Other' 
      WHERE relationship IS NOT NULL 
      AND relationship NOT IN ('Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Other');
    `);

    // Change the column type to ENUM
    await queryInterface.changeColumn('dependents', 'relationship', {
      type: Sequelize.ENUM('Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Other'),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to STRING
    await queryInterface.changeColumn('dependents', 'relationship', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // Drop the ENUM type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_dependents_relationship";
    `);
  }
}; 