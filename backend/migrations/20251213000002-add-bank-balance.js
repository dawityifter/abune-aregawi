'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Add column
        await queryInterface.addColumn('bank_transactions', 'balance', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true // Allow null for now to support old data before backfill
        });

        // 2. Backfill from raw_data
        // Note: We can't easily run complex JS backfill in a migration usually, 
        // but we can query raw_data and update. 
        // However, Sequelize migration is best for Schema. 
        // I will write a separate script or just do the schema change first.
        // Actually, let's try to do it in SQL if possible, but postgres JSON extraction is specific.
        // simpler: just add column, and I'll make a separate tool/script call to backfill,
        // OR just rely on re-upload if duplicate check allows updating?
        // User data is small. 
        // But I promised a backfill script.
        // I'll create a standalone script `scripts/backfill_bank_balance.js` and run it.
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('bank_transactions', 'balance');
    }
};
