'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('volunteer_requests', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            member_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'members',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            message: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            agreed_to_contact: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('new', 'contacted', 'archived'),
                defaultValue: 'new',
                allowNull: false
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

        // Add index for status lookup
        await queryInterface.addIndex('volunteer_requests', ['status']);

        // Add index for member lookup
        await queryInterface.addIndex('volunteer_requests', ['member_id']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('volunteer_requests');
    }
};
