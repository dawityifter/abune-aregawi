'use strict';
require('dotenv').config();
const { sequelize } = require('../models');

async function up() {
  const qi = sequelize.getQueryInterface();
  const Sequelize = require('sequelize');
  console.log('🔍 Checking for is_imported column on members...');
  const desc = await qi.describeTable('members');
  if (desc && desc.is_imported) {
    console.log('ℹ️  Column is_imported already exists. Skipping.');
    return;
  }
  console.log('🔄 Adding is_imported (BOOLEAN DEFAULT false) to members...');
  await qi.addColumn('members', 'is_imported', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  });
  console.log('✅ Added is_imported to members');
}

async function down() {
  const qi = sequelize.getQueryInterface();
  console.log('🔍 Checking for is_imported column on members (for removal)...');
  const desc = await qi.describeTable('members');
  if (!desc || !desc.is_imported) {
    console.log('ℹ️  Column is_imported does not exist. Nothing to remove.');
    return;
  }
  console.log('♻️ Removing is_imported from members...');
  await qi.removeColumn('members', 'is_imported');
  console.log('✅ Removed is_imported from members');
}

async function run() {
  try {
    await sequelize.authenticate();
    const direction = process.argv.includes('--down') ? 'down' : 'up';
    if (direction === 'up') {
      await up();
    } else {
      await down();
    }
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) run();

module.exports = { up, down };
