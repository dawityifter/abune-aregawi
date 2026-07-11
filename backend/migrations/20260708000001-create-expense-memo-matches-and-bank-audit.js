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
    // 1. Learned expense classifications for auto-reconciling bank debits.
    // In development the table may already exist via sequelize.sync().
    if (!(await tableExists(queryInterface, 'expense_memo_matches'))) {
      await queryInterface.createTable('expense_memo_matches', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        match_key: {
          type: Sequelize.STRING(512),
          allowNull: false
        },
        source_type: {
          type: Sequelize.STRING(40),
          allowNull: false
        },
        gl_code: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        payee_name: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        vendor_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'vendors', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        employee_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'employees', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        raw_description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_from_bank_transaction_id: {
          type: Sequelize.INTEGER,
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

      await queryInterface.addConstraint('expense_memo_matches', {
        fields: ['match_key'],
        type: 'unique',
        name: 'expense_memo_matches_match_key_unique'
      }).catch(() => {});
      await queryInterface.addIndex('expense_memo_matches', ['gl_code']).catch(() => {});
    }

    // 2. Audit columns for automatic reconciliation on bank_transactions.
    // sync() never alters existing tables, so add each column if missing.
    const bankColumns = await queryInterface.describeTable('bank_transactions');

    if (!bankColumns.reconciled_source) {
      await queryInterface.addColumn('bank_transactions', 'reconciled_source', {
        type: Sequelize.STRING(30),
        allowNull: true
      });
    }
    if (!bankColumns.reconciled_at) {
      await queryInterface.addColumn('bank_transactions', 'reconciled_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!bankColumns.reconciled_meta) {
      await queryInterface.addColumn('bank_transactions', 'reconciled_meta', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('bank_transactions', 'reconciled_meta').catch(() => {});
    await queryInterface.removeColumn('bank_transactions', 'reconciled_at').catch(() => {});
    await queryInterface.removeColumn('bank_transactions', 'reconciled_source').catch(() => {});
    await queryInterface.removeConstraint('expense_memo_matches', 'expense_memo_matches_match_key_unique').catch(() => {});
    await queryInterface.dropTable('expense_memo_matches').catch(() => {});
  }
};
