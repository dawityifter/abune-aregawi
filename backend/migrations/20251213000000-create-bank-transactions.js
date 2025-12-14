'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('bank_transactions', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            transaction_hash: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
                comment: 'Unique hash of date+amount+balance to prevent duplicates'
            },
            date: {
                type: Sequelize.DATEONLY,
                allowNull: false
            },
            amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            type: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'UNKNOWN'
            },
            status: {
                type: Sequelize.ENUM('PENDING', 'MATCHED', 'IGNORED'),
                defaultValue: 'PENDING'
            },
            payer_name: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Extracted name from Zelle/ACH description'
            },
            external_ref_id: {
                type: Sequelize.STRING,
                allowNull: true
            },
            check_number: {
                type: Sequelize.STRING,
                allowNull: true
            },
            raw_data: {
                type: Sequelize.JSON,
                allowNull: true
            },
            member_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'members',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Add index for fast lookups
        await queryInterface.addIndex('bank_transactions', ['status']);
        await queryInterface.addIndex('bank_transactions', ['date']);
        await queryInterface.addIndex('bank_transactions', ['transaction_hash']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('bank_transactions');
    }
};
