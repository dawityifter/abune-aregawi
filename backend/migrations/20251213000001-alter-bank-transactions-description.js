'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Change column type to TEXT
        await queryInterface.changeColumn('bank_transactions', 'description', {
            type: Sequelize.TEXT,
            allowNull: false
        });
    },

    down: async (queryInterface, Sequelize) => {
        // Revert to STRING(255)
        await queryInterface.changeColumn('bank_transactions', 'description', {
            type: Sequelize.STRING(255),
            allowNull: false
        });
    }
};
