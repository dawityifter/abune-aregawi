#!/usr/bin/env node
/**
 * Import transactions from backend/members_payments.csv
 * - Resolves member_id by phone_number from members table
 * - Maps CSV payment_method to Transaction enum
 * - payment_type = 'membership_due'
 * - collected_by = 77 (can override via --collectedBy)
 * - status = 'succeeded'
 * - note = 'Imported from Excel'
 * - payment_date = today (override via --date YYYY-MM-DD)
 * - created_at/updated_at = now
 *
 * Dry-run by default (no DB writes). Use --commit to actually insert.
 *
 * Usage:
 *   node src/database/importMembersPayments.js [--csv backend/members_payments.csv] [--date YYYY-MM-DD] [--collectedBy 77] [--commit]
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Op } = require('sequelize');
const { sequelize, Member, Transaction } = require('../models');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    csvPath: path.resolve(__dirname, '../../members_payments.csv'),
    date: null,
    collectedBy: 77,
    commit: false,
    allowPartial: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--csv') {
      const p = args[++i];
      out.csvPath = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    }
    else if (a === '--date') out.date = args[++i];
    else if (a === '--collectedBy') out.collectedBy = Number(args[++i]);
    else if (a === '--commit') out.commit = true;
    else if (a === '--allowPartial') out.allowPartial = true;
  }
  if (!out.date) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.date = `${yyyy}-${mm}-${dd}`;
  }
  return out;
}

function normalizePhone(p) {
  if (!p) return '';
  let raw = String(p).trim();
  // Handle spreadsheet artifacts like "15127347426.0"
  if (/^\d+\.0$/.test(raw)) raw = raw.replace(/\.0$/, '');
  // strip spaces and non-digits except leading '+'
  let s = raw.replace(/[^+\d]/g, '');
  if (s && !s.startsWith('+')) {
    // assume US, add +1 if 10 digits
    const digits = s.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  }
  return s;
}

function mapPaymentMethod(vRaw) {
  const v = String(vRaw || '').trim().toLowerCase();
  if (!v) return 'other';
  if (v === 'cash') return 'cash';
  if (v === 'check' || v === 'cheque') return 'check';
  if (v === 'zelle') return 'zelle';
  if (v === 'card' || v === 'credit' || v === 'credit card' || v === 'debit' || v === 'debit card') return 'credit_card';
  if (v === 'paypal' || v === 'pay pal') return 'other';
  if (v === 'dir dep' || v === 'direct deposit' || v === 'direct' || v === 'ach') return 'ach';
  // fall back
  return 'other';
}

async function readCsv(csvPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  const { csvPath, date, collectedBy, commit, allowPartial } = parseArgs();
  console.log(`\n== Import Members Payments ${commit ? '(COMMIT MODE)' : '(DRY RUN)'} ==`);
  console.log(`CSV: ${csvPath}`);
  console.log(`payment_date: ${date}, collected_by: ${collectedBy}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  const csvRows = await readCsv(csvPath);
  console.log(`Read ${csvRows.length} rows from CSV`);

  // Collect distinct phone_numbers from CSV
  const phones = Array.from(new Set(csvRows.map(r => normalizePhone(r.phone_number || r.pnumber || '')))).filter(Boolean);

  await sequelize.authenticate();

  // Fetch members by phone_number in bulk
  const members = await Member.findAll({
    where: { phone_number: { [Op.in]: phones } },
    attributes: ['id', 'phone_number', 'first_name', 'last_name']
  });
  const memberByPhone = new Map(members.map(m => [m.phone_number, m]));

  // Prepare candidate transactions
  const now = new Date();
  const createdAt = now; // timestamps set automatically too, but we set explicitly
  const updatedAt = now;

  const problems = [];
  const payloads = [];

  for (const r of csvRows) {
    const phoneRaw = r.phone_number || r.pnumber || '';
    const phone = normalizePhone(phoneRaw);
    const member = memberByPhone.get(phone);

    // Amount and payment method from current CSV, with fallbacks for older headers
    const amtRaw = (r.amount ?? r.cash_total_collected_amount ?? r['Total Collected amount'] ?? '0');
    const amt = parseFloat(String(amtRaw).replace(/[$,]/g, '')) || 0;
    const method = mapPaymentMethod(r.payment_method ?? r.cash_payment_method ?? r['Paymt Method']);

    const payload = {
      member_id: member?.id || null,
      collected_by: collectedBy,
      payment_date: date,
      amount: amt,
      payment_type: 'membership_due',
      payment_method: method,
      status: 'succeeded',
      receipt_number: 'Imported',
      note: 'Imported from Excel',
      created_at: createdAt,
      updated_at: updatedAt,
    };

    // Validate and collect problems
    const rowIssues = [];
    if (!member) rowIssues.push(`No member match for phone ${phoneRaw}`);
    if (!(amt > 0)) rowIssues.push('Amount must be > 0');

    if (rowIssues.length) {
      problems.push({ phone: phoneRaw, issues: rowIssues, csv: r });
    } else {
      payloads.push(payload);
    }
  }

  console.log(`\nMembers matched: ${memberByPhone.size} of ${phones.length} distinct phones`);
  console.log(`Valid rows ready to insert: ${payloads.length}`);
  console.log(`Rows with issues: ${problems.length}`);

  if (payloads[0]) {
    console.log('\nSample payload:', payloads[0]);
  }
  if (problems[0]) {
    console.log('\nSample problem:', problems[0]);
  }

  if (!commit) {
    console.log('\nDRY RUN complete. No records were written.');
    await sequelize.close();
    return;
  }

  if (problems.length && !allowPartial) {
    console.error(`\nRefusing to commit due to invalid rows (${problems.length}). Re-run with --allowPartial to insert ${payloads.length} valid rows and skip problematic ones.`);
    await sequelize.close();
    process.exit(1);
  }

  // Commit: insert all
  console.log(`\nInserting ${payloads.length} transactions...${problems.length ? ` (skipping ${problems.length} problematic rows)` : ''}`);
  await Transaction.bulkCreate(payloads, { validate: true, individualHooks: true });
  console.log('Insert complete.');

  await sequelize.close();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
