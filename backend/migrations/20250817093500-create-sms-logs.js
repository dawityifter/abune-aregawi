'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('sms_logs', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
        sender_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        role: { type: Sequelize.STRING(50), allowNull: false },
        recipient_type: { type: Sequelize.ENUM('individual', 'group', 'all'), allowNull: false },
        recipient_member_id: { type: Sequelize.BIGINT, allowNull: true },
        group_id: { type: Sequelize.BIGINT, allowNull: true },
        recipient_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        message: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.ENUM('success', 'partial', 'failed'), allowNull: false },
        error: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction: t });

      await queryInterface.addIndex('sms_logs', ['sender_id'], { transaction: t });
      await queryInterface.addIndex('sms_logs', ['recipient_type'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('sms_logs', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};
