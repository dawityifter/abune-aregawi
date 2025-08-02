'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the column exists before trying to remove it
    const tableDescription = await queryInterface.describeTable('members');
    if (tableDescription.login_email) {
      await queryInterface.removeColumn('members', 'login_email');
      console.log('✅ Removed login_email column');
    } else {
      console.log('ℹ️  login_email column does not exist, skipping removal');
    }
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