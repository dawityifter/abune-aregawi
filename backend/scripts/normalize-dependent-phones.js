#!/usr/bin/env node
/**
 * Normalize existing Dependent.phone values to E.164 where possible.
 * - Uses backend Sequelize models at src/models
 * - Batch processes records to avoid memory spikes
 * - Dry-run supported via --dry-run flag
 */

require('dotenv').config();
const path = require('path');

// Ensure we are executing from backend root regardless of where command is run
process.chdir(path.resolve(__dirname, '..'));

const { sequelize, Dependent } = require('../src/models');

function normalizeToE164(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Keep leading + if present, strip other non-digits
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/[^\d]/g, '');
    return digits ? `+${digits}` : null;
  }

  // Only digits
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  // Heuristic for US numbers: 10 digits => +1XXXXXXXXXX, 11 with leading 1 => +1XXXXXXXXXX
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;

  // Fallback: prefix + if not already present
  return `+${digitsOnly}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
  const limit = Number(process.env.BACKFILL_BATCH_SIZE || 500);

  console.log('🛠  Dependent Phone Normalization');
  console.log('  dryRun:', dryRun);
  console.log('  batch size:', limit);
  console.log('  NODE_ENV:', process.env.NODE_ENV);

  try {
    await sequelize.authenticate();
    console.log('✅ DB connection OK');
  } catch (e) {
    console.error('❌ DB connection failed:', e.message);
    process.exit(1);
  }

  let offset = 0;
  let total = 0;
  let changed = 0;
  let nullified = 0;
  let examples = [];

  while (true) {
    const rows = await Dependent.findAll({
      attributes: ['id', 'phone', 'firstName', 'lastName'],
      order: [['id', 'ASC']],
      limit,
      offset,
    });
    if (!rows.length) break;

    for (const dep of rows) {
      const current = dep.phone;
      const normalized = normalizeToE164(current);

      // If both null/empty or already equal, skip
      const curClean = (current || '').trim() || null;
      const same = curClean === (normalized || null);

      if (!same) {
        if (dryRun) {
          examples.push({ id: dep.id, from: current, to: normalized, name: `${dep.firstName} ${dep.lastName}` });
        } else {
          await dep.update({ phone: normalized });
        }
        changed++;
        if (normalized === null) nullified++;
      }

      total++;
    }

    console.log(`  processed: ${Math.min(offset + rows.length, total)} (changed: ${changed})`);
    offset += rows.length;
  }

  console.log('📊 Summary');
  console.log('  total dependents scanned:', total);
  console.log('  changed:', changed);
  console.log('  set to null (invalid/empty):', nullified);

  if (dryRun && examples.length) {
    console.log('🔎 Sample changes (up to 20):');
    for (const ex of examples.slice(0, 20)) {
      console.log(`   #${ex.id} ${ex.name}: '${ex.from}' -> '${ex.to}'`);
    }
  }

  await sequelize.close();
  console.log('✅ Done');
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
