#!/usr/bin/env node
/**
 * Normalize phone_number and spouse_phone columns in a CSV to E.164 format.
 * - Preserves all other columns and row order
 * - Creates a .bak backup before overwriting input when no --out is provided
 *
 * Usage:
 *   node scripts/normalize-members-csv-phones.js --in backend/members_with_plus_e164.csv [--out backend/members_with_plus_e164.csv]
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { in: null, out: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--in') out.in = args[++i];
    else if (a === '--out') out.out = args[++i];
  }
  if (!out.in) {
    console.error('Usage: node scripts/normalize-members-csv-phones.js --in <input.csv> [--out <output.csv>]');
    process.exit(1);
  }
  return out;
}

function normalizeToE164(input) {
  if (input === undefined || input === null) return '';
  let s = String(input).trim();
  if (!s) return '';

  // If the value looks like a number with trailing .0s, drop the decimal part first
  // e.g., 15127347426.0 => 15127347426
  s = s.replace(/\.0+$/i, '');

  // Remove surrounding quotes/spaces
  s = s.replace(/^"|"$/g, '').trim();

  if (s.startsWith('+')) {
    // Keep leading +, strip all non-digits afterwards
    const digits = s.slice(1).replace(/[^\d]/g, '');
    return digits ? `+${digits}` : '';
  }

  // Strip everything but digits
  const digitsOnly = s.replace(/[^\d]/g, '');
  if (!digitsOnly) return '';

  // US heuristics
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;

  // Fallback
  return `+${digitsOnly}`;
}

async function main() {
  const { in: inPathArg, out: outPathArg } = parseArgs();
  const inPath = path.isAbsolute(inPathArg) ? inPathArg : path.resolve(process.cwd(), inPathArg);
  const outPath = outPathArg
    ? (path.isAbsolute(outPathArg) ? outPathArg : path.resolve(process.cwd(), outPathArg))
    : inPath; // default overwrite

  if (!fs.existsSync(inPath)) {
    console.error(`❌ Input CSV not found: ${inPath}`);
    process.exit(1);
  }

  const rows = [];
  let headers = null;

  await new Promise((resolve, reject) => {
    fs.createReadStream(inPath)
      .pipe(csv())
      .on('headers', (h) => { headers = h; })
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  if (!headers) {
    console.error('❌ Could not read CSV headers');
    process.exit(1);
  }

  // Ensure columns exist; if missing, add them when writing
  if (!headers.includes('phone_number')) headers.push('phone_number');
  if (!headers.includes('spouse_phone')) headers.push('spouse_phone');

  let changed = 0;
  const normalizedRows = rows.map((row) => {
    const beforePhone = row.phone_number ?? '';
    const beforeSpouse = row.spouse_phone ?? '';

    const afterPhone = normalizeToE164(beforePhone);
    const afterSpouse = normalizeToE164(beforeSpouse);

    if ((beforePhone || '') !== afterPhone || (beforeSpouse || '') !== afterSpouse) changed++;

    return {
      ...row,
      phone_number: afterPhone,
      spouse_phone: afterSpouse,
    };
  });

  // If overwriting, create a backup
  if (outPath === inPath) {
    const backup = `${inPath}.bak`;
    fs.copyFileSync(inPath, backup);
    console.log(`🗄️  Backup created: ${backup}`);
  }

  // Write CSV manually to preserve column order; include any new columns at end
  const allColumns = headers;
  const lines = [];
  lines.push(allColumns.join(','));
  for (const r of normalizedRows) {
    const vals = allColumns.map((col) => {
      const v = r[col] === undefined || r[col] === null ? '' : String(r[col]);
      // Escape if contains comma, quote or newline
      if (/[",\n]/.test(v)) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    });
    lines.push(vals.join(','));
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log('✅ Normalization complete');
  console.log('  input:', inPath);
  console.log('  output:', outPath);
  console.log('  rows:', normalizedRows.length);
  console.log('  changed rows:', changed);
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
