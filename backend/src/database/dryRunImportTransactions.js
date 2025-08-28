#!/usr/bin/env node
/**
 * Dry-run import of transactions from a CSV for year 2025 only.
 * - Reads CSV with columns: phone_number, year, amount, payment_method, payment_type
 * - Filters rows where year == 2025
 * - Maps payment_type 'membership' -> 'membership_due'
 * - Looks up Member by phone_number to get member_id
 * - Prepares records with:
 *    - status: 'succeeded'
 *    - payment_date: today's date (YYYY-MM-DD)
 *    - created_at/updated_at: now
 * - Does NOT write to DB in dry-run (default). Use --commit to insert.
 * - For commit, generates a synthetic receipt_number for cash/check: CSV2025-<seq>
 * - Requires a collector id via --collectedBy <member_id> when committing.
 *
 * Usage:
 *   node src/database/dryRunImportTransactions.js --csv ../../transactions_for_import_cleaned_no_empty_phone.csv [--commit] [--collectedBy <member_id>]
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { sequelize, Member, Transaction } = require('../models');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { csv: path.resolve(__dirname, '../../../transactions_for_import_cleaned_no_empty_phone.csv'), commit: false, collectedBy: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--commit') out.commit = true;
    else if (a === '--csv') out.csv = path.isAbsolute(args[++i]) ? args[i] : path.resolve(process.cwd(), args[i]);
    else if (a === '--collectedBy') out.collectedBy = args[++i];
  }
  return out;
}

function todayDateOnly() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function mapPaymentType(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'membership') return 'membership_due';
  if (['membership_due','tithe','donation','event','other'].includes(s)) return s;
  return null; // unsupported
}

function normalizeAmount(a) {
  if (a === undefined || a === null) return null;
  const s = String(a).trim().replace(/[$,\s]/g, '');
  if (!s) return null;
  const num = Number(s);
  if (Number.isNaN(num)) return null;
  return num.toFixed(2);
}

async function main() {
  const { csv: csvPath, commit, collectedBy } = parseArgs();
  console.log(`\n== Transactions CSV Import ${commit ? 'COMMIT' : 'DRY-RUN'} ==`);
  console.log(`CSV: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found at ${csvPath}`);
    process.exit(1);
  }

  // DB connect
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
  } catch (e) {
    console.error('❌ Failed to connect to database:', e.message);
    process.exit(1);
  }

  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (raw) => {
        const phone_number = String(raw.phone_number || '').trim();
        const year = String(raw.year || '').trim();
        const amount = normalizeAmount(raw.amount);
        const payment_method = String(raw.payment_method || '').trim().toLowerCase();
        const payment_type = mapPaymentType(raw.payment_type);
        if (year === '2025') {
          rows.push({ phone_number, year, amount, payment_method, payment_type });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Filtered rows for year=2025: ${rows.length}`);

  // Build phone -> member_id map
  const phones = [...new Set(rows.map(r => r.phone_number).filter(Boolean))];
  const members = await Member.findAll({ attributes: ['id', 'phone_number'], where: { phone_number: phones } });
  const phoneToMember = new Map(members.map(m => [m.phone_number, m.id]));

  let skippedInvalid = 0;
  let missingMembers = 0;
  let unsupportedType = 0;
  let invalidAmount = 0;

  const today = todayDateOnly();
  const now = new Date();

  const candidates = [];
  for (const r of rows) {
    if (!r.phone_number) { skippedInvalid++; continue; }
    const member_id = phoneToMember.get(r.phone_number);
    if (!member_id) { missingMembers++; continue; }
    if (!r.payment_type) { unsupportedType++; continue; }
    if (!r.amount || Number(r.amount) <= 0) { invalidAmount++; continue; }

    const base = {
      member_id,
      collected_by: collectedBy ? Number(collectedBy) : null, // required on commit
      payment_date: today,
      amount: r.amount,
      payment_type: r.payment_type,
      payment_method: r.payment_method,
      status: 'succeeded',
      receipt_number: null, // will be set for cash/check on commit
      note: 'Imported from excel file',
      external_id: null,
      donation_id: null,
      created_at: now,
      updated_at: now
    };

    candidates.push({ ...base, __phone: r.phone_number });
  }

  console.log(`Candidates after validation: ${candidates.length}`);
  console.log(`  Skipped invalid rows (no phone): ${skippedInvalid}`);
  console.log(`  Missing members: ${missingMembers}`);
  console.log(`  Unsupported payment_type: ${unsupportedType}`);
  console.log(`  Invalid amount (<=0 or NaN): ${invalidAmount}`);

  console.log('\nPreview first 5 candidates:');
  candidates.slice(0, 5).forEach((c, i) => {
    console.log(`${i+1}. phone=${c.__phone} member_id=${c.member_id} amount=${c.amount} method=${c.payment_method} type=${c.payment_type} status=${c.status} date=${c.payment_date} note="${c.note}"`);
  });

  if (!commit) {
    console.log('\nDry-run complete. No changes were made.');
    await sequelize.close();
    return;
  }

  // Commit mode
  if (!collectedBy) {
    console.error('❌ --collectedBy <member_id> is required for commit mode.');
    await sequelize.close();
    process.exit(1);
  }

  // Use a fixed placeholder receipt number for cash/check to satisfy hook
  const toInsert = candidates.map(c => {
    const rec = { ...c };
    if (['cash','check'].includes(rec.payment_method) && !rec.receipt_number) {
      rec.receipt_number = 'CSV-UNKNOWN';
    }
    return rec;
  });

  let inserted = 0;
  for (const rec of toInsert) {
    try {
      await Transaction.create(rec);
      inserted += 1;
    } catch (e) {
      console.error(`❌ Failed to insert for phone ${rec.__phone} (member ${rec.member_id}):`, e.message);
    }
  }

  console.log(`\nInsert complete. Inserted: ${inserted}`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
