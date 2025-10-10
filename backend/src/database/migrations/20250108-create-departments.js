'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create departments table
    await queryInterface.createTable('departments', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'ministry',
        comment: 'ministry, committee, service, social, administrative'
      },
      parent_department_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'departments',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      leader_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      contact_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      meeting_schedule: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'e.g., Every Sunday 10am in Fellowship Hall'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Members can see and request to join'
      },
      max_members: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'NULL = unlimited'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create department_members table
    await queryInterface.createTable('department_members', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      department_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'departments',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      role_in_department: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'member',
        comment: 'member, leader, co-leader, coordinator, assistant'
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        comment: 'active, inactive, pending'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint on department_id + member_id
    await queryInterface.addConstraint('department_members', {
      fields: ['department_id', 'member_id'],
      type: 'unique',
      name: 'unique_department_member'
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('departments', ['type']);
    await queryInterface.addIndex('departments', ['is_active']);
    await queryInterface.addIndex('departments', ['leader_id']);
    await queryInterface.addIndex('departments', ['parent_department_id']);
    
    await queryInterface.addIndex('department_members', ['department_id']);
    await queryInterface.addIndex('department_members', ['member_id']);
    await queryInterface.addIndex('department_members', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('department_members');
    await queryInterface.dropTable('departments');
  }
};
