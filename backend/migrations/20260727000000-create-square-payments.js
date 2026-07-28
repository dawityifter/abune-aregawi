'use strict';

async function tableExists(queryInterface, table) {
  try {
    await queryInterface.describeTable(table);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // In development the table may already exist via sequelize.sync().
    // Only create it (and its indexes) when absent, so this migration is
    // safe to run against both synced local DBs and fresh production DBs.
    if (await tableExists(queryInterface, 'square_payments')) {
      return;
    }

    await queryInterface.createTable('square_payments', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      square_payment_id: {
        type: Sequelize.STRING(191),
        allowNull: false
      },
      order_id: {
        type: Sequelize.STRING(191),
        allowNull: true
      },
      location_id: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: true
      },
      square_created_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      buyer_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      buyer_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      card_brand: {
        type: Sequelize.STRING(40),
        allowNull: true
      },
      card_last4: {
        type: Sequelize.STRING(8),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'NEEDS_REVIEW'
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
      transaction_id: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      raw: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      processed_at: {
        allowNull: true,
        type: Sequelize.DATE
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addConstraint('square_payments', {
      fields: ['square_payment_id'],
      type: 'unique',
      name: 'square_payments_square_payment_id_unique'
    }).catch(() => {});
    await queryInterface.addIndex('square_payments', ['status']).catch(() => {});
    await queryInterface.addIndex('square_payments', ['matched_member_id']).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('square_payments', 'square_payments_square_payment_id_unique').catch(() => {});
    await queryInterface.removeIndex('square_payments', ['status']).catch(() => {});
    await queryInterface.removeIndex('square_payments', ['matched_member_id']).catch(() => {});
    await queryInterface.dropTable('square_payments').catch(() => {});
  }
};
