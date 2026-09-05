'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Extend payment_type enum (safe idempotent DO block)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        ALTER TYPE "enum_transactions_payment_type" ADD VALUE IF NOT EXISTS 'loan_received';
        ALTER TYPE "enum_transactions_payment_type" ADD VALUE IF NOT EXISTS 'loan_repayment';
      EXCEPTION WHEN others THEN null; END $$;
    `);

    // 2. Create member_loans table
    await queryInterface.createTable('member_loans', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      member_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: 'members', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      },
      transaction_id: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'transactions', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      outstanding_balance: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      payment_method: { type: Sequelize.STRING(50), allowNull: false },
      receipt_number: { type: Sequelize.STRING(100), allowNull: true },
      loan_date: { type: Sequelize.DATEONLY, allowNull: false },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'PARTIALLY_REPAID', 'CLOSED'),
        allowNull: false, defaultValue: 'ACTIVE'
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      collected_by: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'members', key: 'id' }
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('member_loans', ['member_id']);
    await queryInterface.addIndex('member_loans', ['status']);
    await queryInterface.addIndex('member_loans', ['loan_date']);
    await queryInterface.sequelize.query(`
      ALTER TABLE member_loans ADD CONSTRAINT chk_loan_amount_positive CHECK (amount > 0);
      ALTER TABLE member_loans ADD CONSTRAINT chk_balance_non_negative CHECK (outstanding_balance >= 0);
      ALTER TABLE member_loans ADD CONSTRAINT chk_balance_lte_amount CHECK (outstanding_balance <= amount);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('member_loans');
  }
};
