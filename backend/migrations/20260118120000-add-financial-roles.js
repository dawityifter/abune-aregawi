'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add new values to the enum_members_role enum
        // Note: Postgres doesn't support adding multiple values in one ALTER TYPE command
        // We must execute them sequentially and handle potential "already exists" errors (though IF NOT EXISTS handles that)

        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.sequelize.query(`ALTER TYPE "enum_members_role" ADD VALUE IF NOT EXISTS 'bookkeeper'`, { transaction });
            await queryInterface.sequelize.query(`ALTER TYPE "enum_members_role" ADD VALUE IF NOT EXISTS 'budget_committee'`, { transaction });
            await queryInterface.sequelize.query(`ALTER TYPE "enum_members_role" ADD VALUE IF NOT EXISTS 'auditor'`, { transaction });
            await queryInterface.sequelize.query(`ALTER TYPE "enum_members_role" ADD VALUE IF NOT EXISTS 'ar_team'`, { transaction });
            await queryInterface.sequelize.query(`ALTER TYPE "enum_members_role" ADD VALUE IF NOT EXISTS 'ap_team'`, { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Reverting ENUM changes in Postgres is difficult (requires creating new type, migrating data, dropping old type)
        // For this migration, we will acknowledge that role removal is destructive and complicated.
        // We will leave the enum values as they are because removing them might break data integrity if any user was assigned one of these roles.
        console.warn('Migration down: Cannot safely remove enum values provided by "add-financial-roles" without potential data loss. Enum values retained.');
    }
};
