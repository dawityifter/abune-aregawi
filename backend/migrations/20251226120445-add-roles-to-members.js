'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add roles column
        await queryInterface.addColumn('members', 'roles', {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: []
        });

        // Backfill existing role into roles array
        const members = await queryInterface.sequelize.query(
            'SELECT id, role FROM members',
            { type: Sequelize.QueryTypes.SELECT }
        );

        for (const member of members) {
            const rolesArray = member.role ? [member.role] : ['member'];
            await queryInterface.sequelize.query(
                'UPDATE members SET roles = :roles WHERE id = :id',
                {
                    replacements: {
                        roles: JSON.stringify(rolesArray),
                        id: member.id
                    },
                    type: Sequelize.QueryTypes.UPDATE
                }
            );
        }

        // Optional: make roles NOT NULL after backfill if supported by dialect
        // SQLite doesn't support changing constraints easily, so we leave as is or use a default.
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('members', 'roles');
    }
};
