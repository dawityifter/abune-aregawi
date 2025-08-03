'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create ENUM types if they don't exist
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_church_transactions_payment_type" AS ENUM (
          'membership_due', 'tithe', 'donation', 'event', 'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_church_transactions_payment_method" AS ENUM (
          'cash', 'check', 'zelle', 'credit_card', 'debit_card', 'ach', 'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create the church_transactions table
    await queryInterface.createTable('church_transactions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      collected_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0.01
        }
      },
      payment_type: {
        type: Sequelize.ENUM('membership_due', 'tithe', 'donation', 'event', 'other'),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'check', 'zelle', 'credit_card', 'debit_card', 'ach', 'other'),
        allowNull: false
      },
      receipt_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('church_transactions', ['member_id']);
    await queryInterface.addIndex('church_transactions', ['collected_by']);
    await queryInterface.addIndex('church_transactions', ['payment_date']);
    await queryInterface.addIndex('church_transactions', ['payment_type']);
    await queryInterface.addIndex('church_transactions', ['payment_method']);

    // Add CHECK constraint to enforce receipt_number for cash/check payments
    await queryInterface.sequelize.query(`
      ALTER TABLE church_transactions 
      ADD CONSTRAINT check_receipt_for_cash_check 
      CHECK (
        (payment_method IN ('cash', 'check') AND receipt_number IS NOT NULL) OR
        (payment_method NOT IN ('cash', 'check'))
      );
    `);

    // Add CHECK constraint to ensure amount is positive
    await queryInterface.sequelize.query(`
      ALTER TABLE church_transactions 
      ADD CONSTRAINT check_positive_amount 
      CHECK (amount > 0);
    `);

    console.log('✅ Created church_transactions table with all constraints and indexes');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the table (this will also drop the constraints and indexes)
    await queryInterface.dropTable('church_transactions');
    
    // Drop the ENUM types
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_church_transactions_payment_type";
    `);
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_church_transactions_payment_method";
    `);
    
    console.log('✅ Dropped church_transactions table and ENUM types');
  }
}; 