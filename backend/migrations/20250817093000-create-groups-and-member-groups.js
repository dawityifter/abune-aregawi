'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('groups', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
        name: { type: Sequelize.STRING(150), allowNull: false },
        description: { type: Sequelize.STRING(500), allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction: t });

      await queryInterface.createTable('member_groups', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
        member_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        group_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'groups', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
      }, { transaction: t });

      await queryInterface.addIndex('member_groups', ['group_id'], { transaction: t });
      await queryInterface.addIndex('member_groups', ['member_id'], { transaction: t });
      await queryInterface.addConstraint('member_groups', {
        fields: ['member_id', 'group_id'],
        type: 'unique',
        name: 'uq_member_groups_member_group',
        transaction: t
      });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('member_groups', { transaction: t });
      await queryInterface.dropTable('groups', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};
