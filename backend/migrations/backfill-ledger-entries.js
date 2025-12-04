'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // This is a data migration that backfills ledger entries
    // We'll make this a no-op since it's already been run as a standalone script
    // and we don't want to break the migration chain
    console.log('ℹ️  Backfill ledger entries migration - skipped (already executed as standalone script)');
  },

  down: async (queryInterface, Sequelize) => {
    // No rollback needed - this was a data backfill
    console.log('ℹ️  Backfill ledger entries rollback - no action needed');
  }
};
