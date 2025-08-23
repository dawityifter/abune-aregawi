"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("dependents", "interested_in_serving", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "no",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("dependents", "interested_in_serving");
  },
};
