#!/usr/bin/env node
/**
 * Verify imported 2025 transactions and export summary CSV.
 * Filters by:
 *  - note (default: 'Imported from Excel', override via --note)
 *  - collected_by = 3 (default, override via --collectedBy)
 *  - payment_date = today (default, override via --date YYYY-MM-DD)
 * Outputs counts and writes CSV summary to ../../transactions_2025_import_summary.csv
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Op } = require('sequelize');
const { sequelize, Member, Transaction } = require('../models');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { collectedBy: 3, date: null, note: 'Imported from Excel', out: path.resolve(__dirname, '../../transactions_2025_import_summary.csv') };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--collectedBy') out.collectedBy = Number(args[++i]);
    else if (a === '--date') out.date = args[++i];
    else if (a === '--note') out.note = args[++i];
    else if (a === '--out') {
      const next = args[++i];
      out.out = path.isAbsolute(next) ? next : path.resolve(process.cwd(), next);
    }
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

async function main() {
  const { collectedBy, date, note, out } = parseArgs();
  console.log(`\n== Verify Transactions Import ==`);
  console.log(`Filter: collected_by=${collectedBy}, payment_date=${date}, note='${note}'`);

  await sequelize.authenticate();

  // Fetch with join to Member for phone_number
  const rows = await Transaction.findAll({
    where: {
      collected_by: collectedBy,
      payment_date: date,
      note: note
    },
    include: [{ model: Member, as: 'member', attributes: ['phone_number'] }],
    order: [['id', 'ASC']]
  });

  const total = rows.length;
  const byMethod = rows.reduce((acc, r) => {
    acc[r.payment_method] = (acc[r.payment_method] || 0) + 1;
    return acc;
  }, {});

  console.log(`Total matched: ${total}`);
  console.log('By payment_method:', byMethod);
  if (rows[0]) {
    console.log('Sample:', {
      id: rows[0].id,
      phone_number: rows[0].member?.phone_number,
      amount: rows[0].amount,
      method: rows[0].payment_method,
      type: rows[0].payment_type,
      receipt_number: rows[0].receipt_number
    });
  }

  // Write CSV
  const header = 'phone_number,amount,payment_method,payment_type,payment_date,receipt_number,note\n';
  const lines = rows.map(r => [
    r.member?.phone_number || '',
    Number(r.amount).toFixed(2),
    r.payment_method,
    r.payment_type,
    r.payment_date,
    r.receipt_number || '',
    (r.note || '').replace(/\n/g, ' ')
  ].join(','));

  fs.writeFileSync(out, header + lines.join('\n'));
  console.log(`\nSummary CSV written to: ${out}`);

  await sequelize.close();
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
