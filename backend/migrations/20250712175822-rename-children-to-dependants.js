'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('children', 'dependants');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('dependants', 'children');
  }
};
