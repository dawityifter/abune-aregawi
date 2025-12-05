'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns to department_meetings
    await queryInterface.addColumn('department_meetings', 'purpose', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Short description of the meeting purpose'
    });

    await queryInterface.addColumn('department_meetings', 'agenda', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Detailed agenda for the meeting'
    });

    // Modify department_tasks table
    // 1. Add new status value 'rejected' to the enum
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_department_tasks_status ADD VALUE IF NOT EXISTS 'rejected';
    `);

    // 2. Add new columns
    await queryInterface.addColumn('department_tasks', 'start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Task start date'
    });

    await queryInterface.addColumn('department_tasks', 'end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Task end date (replaces due_date semantically)'
    });

    await queryInterface.addColumn('department_tasks', 'rejected_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Date when task was rejected (required when status=rejected)'
    });

    await queryInterface.addColumn('department_tasks', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Additional notes about the task'
    });

    // Note: We're keeping 'description' and 'due_date' for backward compatibility
    // Frontend can use 'description' as 'objective' and 'due_date' as 'end_date'
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns from department_meetings
    await queryInterface.removeColumn('department_meetings', 'purpose');
    await queryInterface.removeColumn('department_meetings', 'agenda');

    // Remove columns from department_tasks
    await queryInterface.removeColumn('department_tasks', 'start_date');
    await queryInterface.removeColumn('department_tasks', 'end_date');
    await queryInterface.removeColumn('department_tasks', 'rejected_date');
    await queryInterface.removeColumn('department_tasks', 'notes');

    // Note: Cannot easily remove enum value 'rejected' in PostgreSQL
    // Would require recreating the enum type, which is complex and risky
    // Leaving it in place for rollback safety
  }
};
