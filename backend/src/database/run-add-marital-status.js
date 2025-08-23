'use strict';
require('dotenv').config();

const path = require('path');
const { sequelize } = require('../models');
const { Sequelize } = require('sequelize');

(async () => {
  const qi = sequelize.getQueryInterface();
  const migrationPath = path.resolve(
    __dirname,
    '../../migrations/20250823000000-add-marital-status-to-members.js'
  );

  console.log('🔌 Connecting to DB...');
  try {
    await sequelize.authenticate();
    console.log('✅ Connected.');
  } catch (e) {
    console.error('❌ Failed to connect:', e.message);
    process.exit(1);
  }

  let migration;
  try {
    migration = require(migrationPath);
  } catch (e) {
    console.error('❌ Failed to load migration file:', migrationPath, e.message);
    process.exit(1);
  }

  try {
    console.log('🚀 Running migration up(): add marital_status to members');
    await migration.up(qi, Sequelize);
    console.log('🎉 Migration completed successfully.');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    try {
      await sequelize.close();
    } catch (_) {}
  }
})();
