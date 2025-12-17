'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const titles = [
            { name: 'Priest', abbreviation: 'Abba', priority: 1 },
            { name: 'Deacon', abbreviation: 'Dn', priority: 2 },
            { name: 'Doctor', abbreviation: 'Dr', priority: 3 },
            { name: 'Mister', abbreviation: 'Mr', priority: 4 },
            { name: 'Ms', abbreviation: 'Ms', priority: 4 },
            { name: 'Mrs', abbreviation: 'Mrs', priority: 4 },
        ];

        const timestamp = new Date();

        await queryInterface.bulkInsert('titles', titles.map(title => ({
            ...title,
            created_at: timestamp,
            updated_at: timestamp
        })), { ignoreDuplicates: true });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('titles', null, {});
    }
};
