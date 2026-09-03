#!/usr/bin/env node
/**
 * Read-only report on a Chase CSV: what the real parser extracts, and where it
 * comes up empty. Touches no database and writes nothing.
 *
 * Member names are never printed — only counts, and masked initials where an
 * example is genuinely needed to judge a pattern.
 *
 * Usage: node analyze-chase-csv.js <path-to-chase.csv>
 */
const fs = require('fs');
const { parseChaseCSV } = require('../src/services/bankParserService');
const { sourceTypeFor, extractAchIndividualName } = require('../src/services/bankMemoMatchService');

const file = process.argv[2];
if (!file) { console.error('Usage: node analyze-chase-csv.js <path-to-chase.csv>'); process.exit(1); }

const buf = fs.readFileSync(file);
const rawLines = buf.toString('utf-8').split(/\r?\n/).filter(l => l.trim());
const rawRows = Math.max(rawLines.length - 1, 0); // minus header

const txns = parseChaseCSV(buf);

const pct = (n, d) => d ? `${((n / d) * 100).toFixed(0)}%` : '—';
const mask = (s) => String(s || '').split(/\s+/).map(w => w ? w[0] + '·'.repeat(Math.max(w.length - 1, 0)) : '').join(' ');

console.log(`\nFILE  ${file}`);
console.log(`rows in file: ${rawRows}   parsed: ${txns.length}`);
if (txns.length < rawRows) {
  console.log(`  !! ${rawRows - txns.length} ROW(S) SILENTLY DROPPED — parseChaseCSV discards rows whose Posting Date won't parse.`);
}

// Header check
const header = (rawLines[0] || '').split(',').map(h => h.trim());
const EXPECTED = ['Details','Posting Date','Description','Amount','Type','Balance','Check or Slip #'];
const missing = EXPECTED.filter(h => !header.includes(h));
if (missing.length) console.log(`  !! missing expected column(s): ${missing.join(', ')}`);

// Per source type
const by = new Map();
for (const t of txns) {
  const st = sourceTypeFor(t);
  if (!by.has(st)) by.set(st, { n: 0, credits: 0, debits: 0, named: 0, checkNum: 0, achMarker: 0, recoverable: 0 });
  const b = by.get(st);
  b.n++;
  if (Number(t.amount) > 0) b.credits++; else b.debits++;
  if (t.payer_name) b.named++;
  if (t.check_number) b.checkNum++;
  if (/IND NAME:/i.test(t.description || '')) b.achMarker++;
  // Unnamed, but an ACH individual name is sitting in the description
  if (!t.payer_name && extractAchIndividualName(t.description)) b.recoverable++;
}

console.log('\nBY SOURCE TYPE');
console.log('  type                rows  cred  debit   payer-name   check-no');
for (const [st, b] of [...by.entries()].sort((a, b2) => b2[1].n - a[1].n)) {
  console.log(`  ${st.padEnd(18)} ${String(b.n).padStart(5)} ${String(b.credits).padStart(5)} ${String(b.debits).padStart(6)}   ${(b.named + '/' + b.n).padStart(9)} ${pct(b.named, b.n).padStart(5)}  ${(b.checkNum + '/' + b.n).padStart(8)}`);
  if (b.recoverable) console.log(`      ^ ${b.recoverable} row(s) have an extractable IND NAME the parser did not capture`);
}

// Check debits with no number — the rows that render red as NOT RECONCILED
const checkDebits = txns.filter(t => Number(t.amount) < 0 && (sourceTypeFor(t) === 'CHECK' || t.check_number));
const noNum = checkDebits.filter(t => !t.check_number);
console.log(`\nCHECK DEBITS  ${checkDebits.length} total, ${noNum.length} with no extractable number`);
noNum.slice(0, 8).forEach(t => console.log(`    no number: "${String(t.description).slice(0, 60)}"`));

// Credits with no payer name at all
const unnamed = txns.filter(t => Number(t.amount) > 0 && !t.payer_name);
console.log(`\nCREDITS WITH NO PAYER NAME  ${unnamed.length}`);
const shapes = new Map();
for (const t of unnamed) {
  const shape = String(t.description).replace(/[A-Za-z]{2,}/g, '<W>').replace(/[0-9]{2,}/g, '<N>');
  shapes.set(shape, (shapes.get(shape) || 0) + 1);
}
[...shapes.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 8)
  .forEach(([s, n]) => console.log(`    ${String(n).padStart(4)}  ${s.slice(0, 70)}`));

// Duplicate hashes — these collide on ingest and get skipped as already-seen
const seen = new Map();
for (const t of txns) seen.set(t.transaction_hash, (seen.get(t.transaction_hash) || 0) + 1);
const dupes = [...seen.values()].filter(v => v > 1).length;
console.log(`\nDUPLICATE transaction_hash within this file: ${dupes}`);
if (dupes) console.log('    (same date+description+amount; the second copy is skipped on upload)');

// Zelle reference coverage — drives Tier 0 exact linking
const zelle = txns.filter(t => sourceTypeFor(t) === 'ZELLE');
const withRef = zelle.filter(t => t.external_ref_id);
console.log(`\nZELLE  ${zelle.length} rows, ${withRef.length} with a reference id (${pct(withRef.length, zelle.length)}) — drives exact Tier 0 linking`);
const zelleUnnamed = zelle.filter(t => !t.payer_name);
if (zelleUnnamed.length) {
  console.log(`  !! ${zelleUnnamed.length} Zelle row(s) with NO payer name:`);
  zelleUnnamed.slice(0, 5).forEach(t => console.log(`       "${mask(t.description).slice(0, 70)}"`));
}

// Amount sanity
const zero = txns.filter(t => Number(t.amount) === 0);
if (zero.length) console.log(`\n!! ${zero.length} row(s) parsed to amount 0 — check the Amount column format`);
console.log('');
