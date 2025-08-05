'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('donations', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      stripe_payment_intent_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      stripe_customer_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'usd'
      },
      donation_type: {
        type: Sequelize.ENUM('one-time', 'recurring'),
        allowNull: false
      },
      frequency: {
        type: Sequelize.ENUM('weekly', 'monthly', 'quarterly', 'yearly'),
        allowNull: true
      },
      payment_method: {
        type: Sequelize.ENUM('card', 'ach'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'canceled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      donor_first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      donor_last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      donor_email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      donor_phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      donor_address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      donor_zip_code: {
        type: Sequelize.STRING,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
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
    await queryInterface.addIndex('donations', ['stripe_payment_intent_id']);
    await queryInterface.addIndex('donations', ['donor_email']);
    await queryInterface.addIndex('donations', ['status']);
    await queryInterface.addIndex('donations', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('donations');
  }
}; 