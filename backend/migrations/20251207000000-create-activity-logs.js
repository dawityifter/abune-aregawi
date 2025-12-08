'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('activity_logs', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'members',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            action: {
                type: Sequelize.STRING,
                allowNull: false
            },
            entity_type: {
                type: Sequelize.STRING,
                allowNull: true
            },
            entity_id: {
                type: Sequelize.STRING, // Using STRING to support various ID types (int/uuid)
                allowNull: true
            },
            details: {
                type: Sequelize.JSONB, // Use JSONB for better performance on PG, falls back to JSON on others
                allowNull: true
            },
            ip_address: {
                type: Sequelize.STRING,
                allowNull: true
            },
            user_agent: {
                type: Sequelize.STRING,
                allowNull: true
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add indexes for common lookup patterns
        await queryInterface.addIndex('activity_logs', ['user_id']);
        await queryInterface.addIndex('activity_logs', ['entity_type', 'entity_id']);
        await queryInterface.addIndex('activity_logs', ['action']);
        await queryInterface.addIndex('activity_logs', ['created_at']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('activity_logs');
    }
};
