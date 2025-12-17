'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('members', 'title_id', {
            type: Sequelize.INTEGER,
            allowNull: true, // Important: Nullable for backward compatibility
            references: {
                model: 'titles',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('members', 'title_id');
    }
};
