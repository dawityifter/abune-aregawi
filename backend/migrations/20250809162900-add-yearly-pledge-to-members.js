'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add yearly_pledge column to members table
    await queryInterface.addColumn('members', 'yearly_pledge', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Yearly membership pledge amount in USD'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove yearly_pledge column
    await queryInterface.removeColumn('members', 'yearly_pledge');
  }
};
