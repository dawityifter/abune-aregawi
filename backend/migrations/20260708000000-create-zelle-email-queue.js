'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('zelle_email_queue', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      gmail_id: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      external_id: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      payer_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      subject: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      matched_member_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      match_confidence: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      match_source: {
        type: Sequelize.STRING(60),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'NEEDS_REVIEW'
      },
      transaction_id: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      processed_at: {
        allowNull: true,
        type: Sequelize.DATE
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addConstraint('zelle_email_queue', {
      fields: ['external_id'],
      type: 'unique',
      name: 'zelle_email_queue_external_id_unique'
    });
    await queryInterface.addIndex('zelle_email_queue', ['status']);
    await queryInterface.addIndex('zelle_email_queue', ['matched_member_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('zelle_email_queue', 'zelle_email_queue_external_id_unique').catch(() => {});
    await queryInterface.removeIndex('zelle_email_queue', ['status']).catch(() => {});
    await queryInterface.removeIndex('zelle_email_queue', ['matched_member_id']).catch(() => {});
    await queryInterface.dropTable('zelle_email_queue');
  }
};
