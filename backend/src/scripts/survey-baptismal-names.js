'use strict';

/**
 * Read-only survey of the baptism_name field, to find out whether a name-day
 * feature is worth building before any of it is built.
 *
 * baptism_name has been collected since registration launched and nothing has
 * ever read it, so nobody knows how many members filled it in or what shape the
 * values take. Everything about name days — the matching strategy, whether it
 * covers enough of the parish to be worth shipping — depends on that answer.
 *
 * SAFETY
 *   - SELECT only. No writes, no schema changes, nothing destructive.
 *   - Prints no individual's name. Name *fragments* are reported only when they
 *     occur MIN_FREQ times or more, so nothing in the output points at a person.
 *     Rarer values are counted in aggregate and never displayed.
 *
 * Usage:
 *   node src/scripts/survey-baptismal-names.js
 *   node src/scripts/survey-baptismal-names.js --min-freq 5
 */

const { Member, Dependent, sequelize } = require('../models');

// A fragment must appear at least this many times before it is printed, so the
// output cannot identify anybody by an unusual name.
const DEFAULT_MIN_FREQ = 3;

// Ethiopian baptismal names are compound: a construct prefix plus the saint or
// divine referent the child is dedicated to. Stripping the prefix is what turns
// "Gebre Michael" into something that can be matched to a commemoration.
const CONSTRUCT_PREFIXES = [
  'gebre', 'gabre', 'gebra', 'gebe', 'g/', 'ገብረ',
  'welde', 'wolde', 'welda', 'w/', 'ወልደ',
  'haile', 'hayle', 'h/', 'ኃይለ', 'ሃይለ',
  'tekle', 'tecle', 'tekla', 't/', 'ተክለ',
  'habte', 'habta', 'ኃብተ', 'ሃብተ',
  'amete', 'amata', 'አመተ',
  'welete', 'wolete', 'ወለተ',
  'kidane', 'ኪዳነ',
  'beale', 'በዓለ',
  // Added after the first survey, which showed these being counted as separate
  // saints: they are all construct forms meaning "something-of", most often of
  // Mary. atsede=አጽደ, askale=አስካለ, fikrte/fikre=ፍቅርተ/ፍቅረ, tsedale=ጸዳለ,
  // tsehaye=ጸሓየ, letay=ለጣይ, mesert=መሠረተ.
  'atsede', 'atsedu', 'አጽደ',
  'askale', 'askal', 'አስካለ',
  'fikrte', 'fikre', 'fikirte', 'ፍቅርተ', 'ፍቅረ',
  'tsedale', 'tsedal', 'ጸዳለ',
  'tsehaye', 'tsehay', 'ጸሓየ',
  'mesert', 'meserete', 'መሠረተ',
  'hirut', 'letay', 'lete', 'ለተ',
  'sine', 'ስነ',
  'dinget', 'ድንግለ', 'dingle'
];

/**
 * The same saint written several ways. Free-text entry produced 132 distinct
 * "referents" across 244 dependents, and much of that is spelling rather than
 * different saints — which made coverage look far worse than it is.
 */
const REFERENT_ALIASES = new Map(Object.entries({
  'maryam': 'mariam', 'mariyam': 'mariam', 'mariam': 'mariam', 'marym': 'mariam',
  'mikael': 'michael', 'mikeal': 'michael', 'mikail': 'michael', 'micheal': 'michael',
  'gebriel': 'gabriel', 'gebrail': 'gabriel', 'gabrel': 'gabriel', 'gebrel': 'gabriel',
  'sellassie': 'selassie', 'silassie': 'selassie', 'sillase': 'selassie', 'selasie': 'selassie',
  'georgis': 'giorgis', 'gorgis': 'giorgis', 'giyorgis': 'giorgis',
  'iyesus': 'eyesus', 'yesus': 'eyesus', 'eyesu': 'eyesus',
  'medhn': 'medhin', 'medhen': 'medhin', 'medhane': 'medhin',
  'amanuel': 'amanuel', 'emanuel': 'amanuel', 'emmanuel': 'amanuel',
  'yohannes': 'yohanes', 'yohans': 'yohanes',
  'aregawi': 'aregawi', 'aregawe': 'aregawi'
}));

const canonical = (referent) => REFERENT_ALIASES.get(referent) || referent;

const normalize = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:_"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasGeez = (s) => /[ሀ-፿]/.test(s);

/** The referent, with any construct prefix removed. */
const referentOf = (normalized) => {
  for (const p of CONSTRUCT_PREFIXES) {
    if (normalized.startsWith(p + ' ')) return normalized.slice(p.length + 1).trim();
    if (normalized.startsWith(p) && normalized.length > p.length + 2 && !p.endsWith('/')) {
      // Written without a space: "gebremichael".
      return normalized.slice(p.length).trim();
    }
    if (p.endsWith('/') && normalized.startsWith(p)) return normalized.slice(p.length).trim();
  }
  return normalized;
};

const tally = (map, key) => map.set(key, (map.get(key) || 0) + 1);

function report(label, rows, minFreq) {
  const total = rows.length;
  const filled = rows.filter((r) => normalize(r).length > 0);
  const geez = filled.filter((r) => hasGeez(r));

  console.log(`\n${label}`);
  console.log(`  total records .................. ${total}`);
  console.log(`  with a baptism name ............ ${filled.length} (${pct(filled.length, total)})`);
  console.log(`  written in Ge'ez script ........ ${geez.length} (${pct(geez.length, filled.length)} of filled)`);
  console.log(`  written in Latin script ........ ${filled.length - geez.length} (${pct(filled.length - geez.length, filled.length)} of filled)`);

  const withPrefix = filled.filter((r) => referentOf(normalize(r)) !== normalize(r));
  console.log(`  compound (Gebre/Welde/etc.) .... ${withPrefix.length} (${pct(withPrefix.length, filled.length)} of filled)`);

  const referents = new Map();
  filled.forEach((r) => tally(referents, canonical(referentOf(normalize(r)))));

  const sorted = [...referents.entries()].sort((a, b) => b[1] - a[1]);
  const shown = sorted.filter(([, n]) => n >= minFreq);
  const hiddenCount = sorted.filter(([, n]) => n < minFreq).reduce((s, [, n]) => s + n, 0);

  console.log(`  distinct referents ............. ${sorted.length}`);
  console.log(`\n  referents occurring ${minFreq}+ times (these are what a map must cover):`);
  if (shown.length === 0) {
    console.log('    (none — every value is too rare to display)');
  } else {
    shown.forEach(([name, n]) => {
      console.log(`    ${String(n).padStart(4)}  ${name}`);
    });
  }
  console.log(`\n  in ${sorted.length - shown.length} rarer referents (not shown): ${hiddenCount} records`);
  console.log(`  coverage if a map handled only the shown referents: ` +
    `${pct(shown.reduce((s, [, n]) => s + n, 0), filled.length)} of filled`);
}

const pct = (n, d) => (d === 0 ? '0%' : `${((100 * n) / d).toFixed(1)}%`);

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--min-freq');
  const minFreq = i >= 0 ? parseInt(args[i + 1], 10) : DEFAULT_MIN_FREQ;

  console.log('Baptismal name survey — READ ONLY, no individual names printed');
  console.log(`Fragments shown only at ${minFreq}+ occurrences`);

  await sequelize.authenticate();

  const members = await Member.findAll({ attributes: ['baptism_name'], raw: true });
  report('MEMBERS', members.map((m) => m.baptism_name), minFreq);

  let dependents = [];
  try {
    dependents = await Dependent.findAll({ attributes: ['baptismName'], raw: true });
    report('DEPENDENTS', dependents.map((d) => d.baptismName), minFreq);
  } catch (e) {
    console.log('\nDEPENDENTS\n  could not read baptismName:', e.message);
  }

  console.log('\nWHAT THIS TELLS US');
  console.log('  If "with a baptism name" is high and the shown referents cover most of');
  console.log('  them, a modest hand-written map makes name days work for most of the');
  console.log('  parish. If coverage is low, the feature needs a prompt asking members');
  console.log('  to supply the name before it is worth surfacing at all.');

  await sequelize.close();
}

// Only run when invoked directly, so the parsing helpers below can be tested
// without opening a database connection. Those helpers are the part Phase 1
// builds on, so they are worth covering now rather than re-deriving later.
if (require.main === module) {
  main().catch(async (err) => {
    console.error('Survey failed:', err.message);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  });
}

module.exports = { normalize, referentOf, canonical, hasGeez, CONSTRUCT_PREFIXES };
