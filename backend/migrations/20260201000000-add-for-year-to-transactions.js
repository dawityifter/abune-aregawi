'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('transactions', 'for_year', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Year this payment applies to (null = use payment_date year)'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('transactions', 'for_year');
    }
};
