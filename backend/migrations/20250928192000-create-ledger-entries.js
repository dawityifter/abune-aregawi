'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum types first
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_ledger_entries_type" AS ENUM ('income', 'expense', 'transfer');
    `);
    
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_ledger_entries_fund" AS ENUM ('general', 'building', 'charity', 'youth', 'other');
    `);
    
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_ledger_entries_payment_method" AS ENUM (
        'cash', 'check', 'zelle', 'credit_card', 'debit_card', 'ach', 'other'
      );
    `);
    
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_ledger_entries_source_system" AS ENUM (
        'manual', 'zelle', 'stripe', 'bank_csv', 'cash', 'check', 'ach', 'other'
      );
    `);

    // Create the ledger_entries table
    await queryInterface.createTable('ledger_entries', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      entry_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      type: {
        type: 'enum_ledger_entries_type',
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0.01,
        },
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
      },
      fund: {
        type: 'enum_ledger_entries_fund',
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      memo: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      attachment_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Linkages
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      collected_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      source_system: {
        type: 'enum_ledger_entries_source_system',
        allowNull: false,
        defaultValue: 'manual',
      },
      external_id: {
        type: Sequelize.STRING(191),
        allowNull: true,
      },
      // Payment/reconciliation
      payment_method: {
        type: 'enum_ledger_entries_payment_method',
        allowNull: true,
      },
      receipt_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      bank_account: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      bank_txn_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cleared: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      statement_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now'),
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('ledger_entries', ['entry_date']);
    await queryInterface.addIndex('ledger_entries', ['type']);
    await queryInterface.addIndex('ledger_entries', ['category']);
    await queryInterface.addIndex('ledger_entries', ['member_id']);
    await queryInterface.addIndex('ledger_entries', ['external_id'], { unique: true });
    await queryInterface.addIndex('ledger_entries', ['bank_txn_id']);
    await queryInterface.addIndex('ledger_entries', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ledger_entries');
    
    // Drop enums
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ledger_entries_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ledger_entries_fund";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ledger_entries_payment_method";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ledger_entries_source_system";');
  },
};
