'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('pledges', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
      pledge_type: {
        type: Sequelize.ENUM('general', 'event', 'fundraising', 'tithe'),
        allowNull: false,
        defaultValue: 'general'
      },
      event_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      pledge_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fulfilled_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      // Contact information (required for non-members)
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      // Optional additional information
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      zip_code: {
        type: Sequelize.STRING,
        allowNull: true
      },
      // Link to donation when fulfilled
      donation_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'donations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      // Notes and metadata
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('pledges', ['member_id']);
    await queryInterface.addIndex('pledges', ['status']);
    await queryInterface.addIndex('pledges', ['pledge_type']);
    await queryInterface.addIndex('pledges', ['email']);
    await queryInterface.addIndex('pledges', ['donation_id']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('pledges');
  }
};
