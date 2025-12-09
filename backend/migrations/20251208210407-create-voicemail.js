'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('voicemails', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            from_number: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            recording_url: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            recording_duration: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            transcription_text: {
                type: Sequelize.TEXT,
                allowNull: true
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
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('voicemails');
    }
};
