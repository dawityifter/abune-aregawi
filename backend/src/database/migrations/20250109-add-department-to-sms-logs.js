'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add department_id column
    await queryInterface.addColumn('sms_logs', 'department_id', {
      type: Sequelize.BIGINT,
      allowNull: true,
      after: 'group_id'
    });

    // Update recipient_type enum to include 'department'
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_sms_logs_recipient_type" ADD VALUE IF NOT EXISTS 'department';
    `);

    console.log('✅ Added department_id column and updated recipient_type enum');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove department_id column
    await queryInterface.removeColumn('sms_logs', 'department_id');
    
    // Note: PostgreSQL doesn't support removing enum values easily
    // In production, you'd need to recreate the enum type
    console.log('⚠️  Removed department_id column. Note: enum value "department" cannot be removed easily from PostgreSQL');
  }
};
