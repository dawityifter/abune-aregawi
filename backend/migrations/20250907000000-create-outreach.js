'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ensure pgcrypto is available for gen_random_uuid()
    try {
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    } catch (_) {}
    await queryInterface.createTable('outreach', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      welcomed_by: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      welcomed_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('outreach', ['member_id']);
    await queryInterface.addIndex('outreach', ['welcomed_date']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('outreach');
  }
};
