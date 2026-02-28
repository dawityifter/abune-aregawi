'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('church_settings', {
      key: { type: Sequelize.STRING(100), primaryKey: true, allowNull: false },
      value: { type: Sequelize.TEXT, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    // Seed the default TV rotation interval
    await queryInterface.bulkInsert('church_settings', [{
      key: 'tv_rotation_interval_seconds',
      value: '30',
      updated_at: new Date()
    }]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('church_settings');
  }
};
