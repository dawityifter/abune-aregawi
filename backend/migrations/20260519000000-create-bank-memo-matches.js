'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bank_memo_matches', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
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
        onDelete: 'RESTRICT'
      },
      source_type: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      match_key: {
        type: Sequelize.STRING(512),
        allowNull: false
      },
      raw_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      payer_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_from_bank_transaction_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bank_transactions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('bank_memo_matches', ['member_id']);
    await queryInterface.addIndex('bank_memo_matches', ['source_type']);
    await queryInterface.addConstraint('bank_memo_matches', {
      fields: ['match_key'],
      type: 'unique',
      name: 'bank_memo_matches_match_key_unique'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('bank_memo_matches', 'bank_memo_matches_match_key_unique').catch(() => {});
    await queryInterface.removeIndex('bank_memo_matches', ['source_type']).catch(() => {});
    await queryInterface.removeIndex('bank_memo_matches', ['member_id']).catch(() => {});
    await queryInterface.dropTable('bank_memo_matches');
  }
};
