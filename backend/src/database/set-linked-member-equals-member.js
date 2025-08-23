'use strict';
require('dotenv').config();

const { sequelize } = require('../models');

async function run({ apply = false } = {}) {
  console.log(`\n=== Set dependents.linked_member_id = dependents.member_id (apply=${apply}) ===`);

  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');
  } catch (e) {
    console.error('❌ Failed to connect to DB:', e.message);
    process.exit(1);
  }

  // Helpers
  const q = (sql, opts = {}) => sequelize.query(sql, { ...opts, raw: true });

  // Count total and mismatches using Postgres 'IS DISTINCT FROM'
  const [[{ total }]] = await q('SELECT COUNT(*)::int AS total FROM dependents;');
  const [[{ mismatches }]] = await q(
    'SELECT COUNT(*)::int AS mismatches FROM dependents WHERE linked_member_id IS DISTINCT FROM member_id;'
  );

  console.log('Total dependents:', total);
  console.log('Rows where linked_member_id != member_id (or NULL):', mismatches);

  // Show sample of first few mismatches for visibility
  if (mismatches > 0) {
    const rows = await q(
      'SELECT id, member_id, linked_member_id FROM dependents WHERE linked_member_id IS DISTINCT FROM member_id ORDER BY id ASC LIMIT 10;',
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('\nSample mismatches (up to 10):');
    rows.forEach(r => console.log(`- id=${r.id} member_id=${r.member_id} linked_member_id=${r.linked_member_id}`));
  }

  if (!apply) {
    console.log('\nDry-run only. No changes written.');
    await sequelize.close();
    return;
  }

  // Apply update in a single statement
  const t = await sequelize.transaction();
  try {
    const [result] = await q(
      'UPDATE dependents SET linked_member_id = member_id;',
      { transaction: t }
    );
    await t.commit();

    // After update, re-count mismatches
    const [[{ mismatches_after }]] = await q(
      'SELECT COUNT(*)::int AS mismatches_after FROM dependents WHERE linked_member_id IS DISTINCT FROM member_id;'
    );

    console.log('\n✅ Update applied.');
    console.log('Rows affected (reported by driver may vary):', result && result.rowCount !== undefined ? result.rowCount : 'N/A');
    console.log('Mismatches remaining after update:', mismatches_after);
  } catch (e) {
    await t.rollback();
    console.error('❌ Update failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { await sequelize.close(); } catch (_) {}
  }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  run({ apply }).catch((e) => {
    console.error('❌ Script error:', e.stack || e.message);
    process.exit(1);
  });
}

module.exports = { run };
