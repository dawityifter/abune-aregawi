#!/usr/bin/env node
/**
 * Import Zelle bank CSV (Posting_date,name,confirmation_number,Amount,member_id,phone_number,first_name,middle_name,last_name,match_source)
 *
 * - Only rows with member_id AND phone_number are considered eligible
 * - Field mapping:
 *    payment_date         <- Posting_date (MM/DD/YYYY -> YYYY-MM-DD)
 *    external_id          <- confirmation_number (RELAXED RULE: any non-empty string with length >= 6)
 *    amount               <- Amount
 *    member_id            <- member_id
 *    status               =  'succeeded'
 *    collected_by         =  3
 *    payment_type         =  'membership_due'
 *    payment_method       =  'zelle'
 *    receipt_number       =  'imported'
 *    note                 =  'imported from bank csv'
 * - Idempotency: skip rows whose external_id already exists (unique index on transactions.external_id)
 * - Dry-run support via --dry-run or -d flag
 * - Custom file path via --file=<path> (defaults to Zelle_Activity_20250922.CSV in CWD)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Op } = require('sequelize');
const { sequelize, Member, Transaction } = require('../src/models');

function readCsv(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function parseRow(line) {
  // Robust parse: assume last 6 columns are stable: member_id, phone_number, first_name, middle_name, last_name, match_source
  const parts = line.split(',');
  if (parts.length < 10) return null; // header or invalid
  const tail = parts.slice(-6);
  const head = parts.slice(0, parts.length - 6);
  if (head.length < 4) return null;
  const posting_date = (head[0] || '').trim();
  const amount = (head[head.length - 1] || '').trim();
  const confirmation_number = (head[head.length - 2] || '').trim();
  // const name = head.slice(1, head.length - 2).join(','); // not used in DB write
  const [member_id, phone_number] = tail.map(s => (s || '').trim());
  return { posting_date, confirmation_number, amount, member_id, phone_number };
}

function mmddyyyyToISO(dateStr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// RELAXED RULE: accept any non-empty external_id of length >= 6 (no digit requirement)
function isValidExternalId(s) {
  if (!s) return false;
  return s.length >= 6;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const fileArg = args.find(a => a.startsWith('--file='));
  const csvPath = fileArg ? path.resolve(fileArg.split('=')[1]) : path.resolve(process.cwd(), 'Zelle_Activity_20250922.CSV');

  console.log(`CSV: ${csvPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);

  await sequelize.authenticate();

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`);
  }

  const lines = readCsv(csvPath).filter(l => l && l.length > 0);
  if (lines.length === 0) throw new Error('CSV is empty');

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const r = parseRow(lines[i]);
    if (!r) continue;
    parsed.push({ ...r, __line: i + 1 });
  }

  // Eligible rows
  const eligible = parsed.filter(r => r.member_id && r.phone_number);

  // Validate members exist
  const memberIds = Array.from(new Set(eligible.map(r => Number(r.member_id)).filter(Boolean)));
  const members = await Member.findAll({ attributes: ['id'], where: { id: { [Op.in]: memberIds } }, raw: true });
  const validMemberSet = new Set(members.map(m => Number(m.id)));
  const eligibleValid = eligible.filter(r => validMemberSet.has(Number(r.member_id)));

  // Existing external_ids to guard duplicates
  const extIds = Array.from(new Set(eligibleValid.map(r => r.confirmation_number).filter(Boolean)));
  const existing = await Transaction.findAll({ attributes: ['external_id'], where: { external_id: { [Op.in]: extIds } }, raw: true });
  const existingSet = new Set(existing.map(e => e.external_id));

  // Build batch
  const toInsert = [];
  let skippedDup = 0, skippedMissingExt = 0, skippedInvalidAmt = 0, skippedBadDate = 0, skippedBadExt = 0;

  for (const r of eligibleValid) {
    if (!r.confirmation_number) { skippedMissingExt++; continue; }
    if (!isValidExternalId(r.confirmation_number)) { skippedBadExt++; continue; }
    if (existingSet.has(r.confirmation_number)) { skippedDup++; continue; }
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || amt <= 0) { skippedInvalidAmt++; continue; }
    const iso = mmddyyyyToISO(r.posting_date);
    if (!iso) { skippedBadDate++; continue; }
    toInsert.push({
      payment_date: iso,
      external_id: r.confirmation_number,
      amount: amt,
      member_id: Number(r.member_id),
      status: 'succeeded',
      collected_by: 3,
      payment_type: 'membership_due',
      payment_method: 'zelle',
      receipt_number: 'imported',
      note: 'imported from bank csv',
      created_at: new Date(),
      updated_at: new Date(),
      __line: r.__line,
    });
  }

  if (dryRun) {
    console.log('--- Dry Run Summary ---');
    console.log('Parsed rows:', parsed.length);
    console.log('Eligible:', eligible.length);
    console.log('Eligible with valid members:', eligibleValid.length);
    console.log('Would attempt inserts:', toInsert.length);
    console.log('Skipping stats -> dup:', skippedDup, ' missing_ext:', skippedMissingExt, ' bad_ext:', skippedBadExt, ' bad_amount:', skippedInvalidAmt, ' bad_date:', skippedBadDate);
    console.log('Sample to insert (up to 10):');
    for (const x of toInsert.slice(0, 10)) {
      console.log(`  line ${x.__line}: external_id=${x.external_id}, member_id=${x.member_id}, amount=${x.amount}, payment_date=${x.payment_date}`);
    }
    await sequelize.close();
    return;
  }

  let insertedCount = 0;
  if (toInsert.length) {
    await sequelize.transaction(async (t) => {
      // Insert one-by-one to honor unique index error messages, could be batched as well
      for (const rec of toInsert) {
        await Transaction.create(rec, { transaction: t });
        insertedCount++;
      }
    });
  }

  console.log('--- Execute Summary ---');
  console.log('Attempted inserts:', toInsert.length);
  console.log('Inserted:', insertedCount);
  console.log('Skipped -> dup:', skippedDup, ' missing_ext:', skippedMissingExt, ' bad_ext:', skippedBadExt, ' bad_amount:', skippedInvalidAmt, ' bad_date:', skippedBadDate);

  await sequelize.close();
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Import failed:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
