'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('titles', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true
            },
            abbreviation: {
                type: Sequelize.STRING(10),
                allowNull: true
            },
            priority: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
                comment: 'Display order priority (lower is higher priority)'
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

        // Add indexes
        await queryInterface.addIndex('titles', ['name']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('titles');
    }
};
