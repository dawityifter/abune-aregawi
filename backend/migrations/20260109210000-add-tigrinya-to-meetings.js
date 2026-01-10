'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('department_meetings', 'title_ti', {
            type: Sequelize.STRING,
            allowNull: true
        });
        await queryInterface.addColumn('department_meetings', 'purpose_ti', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Short description of the meeting purpose in Tigrinya'
        });
        await queryInterface.addColumn('department_meetings', 'agenda_ti', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Detailed agenda for the meeting in Tigrinya'
        });
        await queryInterface.addColumn('department_meetings', 'minutes_ti', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Rich text content of meeting minutes in Tigrinya'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('department_meetings', 'title_ti');
        await queryInterface.removeColumn('department_meetings', 'purpose_ti');
        await queryInterface.removeColumn('department_meetings', 'agenda_ti');
        await queryInterface.removeColumn('department_meetings', 'minutes_ti');
    }
};
