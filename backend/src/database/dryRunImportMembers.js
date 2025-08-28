/*
 Dry-run importer for members CSV. Default behavior: no writes.
 Usage:
   node src/database/dryRunImportMembers.js --csv backend/members_with_plus_e164.csv [--commit]
 Notes:
   - Uniqueness is checked by phone_number (E.164 with +). No insert if present.
   - Maps CSV columns: phone_number, first_name, middle_name, last_name, spouse_phone (ignored), spouse_name, yearly_pledge.
   - Spouse phone is ignored; spouse_name is stored if commit is used.
   - Also detects EXISTING members where yearly_pledge is NULL and CSV provides a value; dry-run lists them.
*/

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { sequelize, Member } = require('../models');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { csv: 'backend/members_with_plus_e164.csv', commit: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--commit') out.commit = true;
    else if (a === '--csv') out.csv = args[++i];
  }
  return out;
}

async function main() {
  const { csv: csvPathInput, commit } = parseArgs();
  const csvPath = path.isAbsolute(csvPathInput)
    ? csvPathInput
    : path.resolve(process.cwd(), csvPathInput);

  console.log(`\n== Members CSV Dry Run ==`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Mode: ${commit ? 'COMMIT (will insert)' : 'DRY-RUN (no writes)'}\n`);

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
  const phoneSeen = new Set();
  let csvDuplicates = 0;
  const csvPledges = new Map(); // phone_number -> pledge string

  // Load CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (raw) => {
        // Normalize and trim fields
        const phone_number = String(raw.phone_number || '').trim();
        const first_name = String(raw.first_name || '').trim();
        const middle_name = String(raw.middle_name || '').trim() || null;
        const last_name = String(raw.last_name || '').trim();
        const spouse_name = String(raw.spouse_name || '').trim() || null;
        const csvPledgeRaw = (raw.yearly_pledge ?? raw["yearly_pledge"]) ?? '';
        // Clean pledge: strip $ and commas/spaces, keep as string to preserve decimals
        let yearly_pledge = '';
        if (csvPledgeRaw !== undefined && csvPledgeRaw !== null) {
          yearly_pledge = String(csvPledgeRaw).trim().replace(/[$,\s]/g, '');
          // Normalize possible trailing .00 etc; keep as-is if not a number
          if (!yearly_pledge) yearly_pledge = '';
        }

        if (phoneSeen.has(phone_number)) {
          csvDuplicates += 1;
        } else if (phone_number) {
          phoneSeen.add(phone_number);
        }

        rows.push({ phone_number, first_name, middle_name, last_name, spouse_name, yearly_pledge });
        if (phone_number) csvPledges.set(phone_number, yearly_pledge);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Validate required fields
  const invalid = rows.filter(r => !r.phone_number || !r.first_name || !r.last_name);
  if (invalid.length > 0) {
    console.log(`⚠️ ${invalid.length} row(s) missing required fields (phone_number, first_name, last_name). They will be skipped.`);
  }

  // Query existing by phone_number in one batch
  const phones = rows.map(r => r.phone_number).filter(Boolean);
  const uniquePhones = [...new Set(phones)];

  console.log(`Parsed rows: ${rows.length}`);
  console.log(`Unique phone numbers in CSV: ${uniquePhones.length}`);
  if (csvDuplicates > 0) {
    console.log(`CSV duplicates by phone_number: ${csvDuplicates}`);
  }

  const { Op } = require('sequelize');
  const existingMembers = await Member.findAll({
    attributes: ['id', 'phone_number', 'yearly_pledge'],
    where: { phone_number: { [Op.in]: uniquePhones } }
  });
  const existingSet = new Set(existingMembers.map(m => m.phone_number));

  // Build unique candidates by phone_number (skip invalid and existing)
  const candidateMap = new Map();
  let invalidCount = 0;
  for (const r of rows) {
    if (!r.phone_number || !r.first_name || !r.last_name) { invalidCount += 1; continue; }
    if (existingSet.has(r.phone_number)) continue;
    if (!candidateMap.has(r.phone_number)) {
      candidateMap.set(r.phone_number, r);
    }
  }
  const candidates = Array.from(candidateMap.values());

  console.log(`\nExisting matches in DB by phone_number: ${existingSet.size}`);
  if (invalidCount > 0) {
    console.log(`Invalid CSV rows (missing required fields): ${invalidCount}`);
  }
  console.log(`Would insert (unique new by phone): ${candidates.length}`);

  // Determine pledge updates for existing members (DB pledge NULL, CSV has value)
  const updates = [];
  for (const m of existingMembers) {
    const csvPledge = (csvPledges.get(m.phone_number) || '').trim();
    const hasCsvPledge = csvPledge !== '';
    const dbPledgeIsNull = m.yearly_pledge === null || m.yearly_pledge === undefined || m.yearly_pledge === '';
    if (hasCsvPledge && dbPledgeIsNull) {
      updates.push({ phone_number: m.phone_number, yearly_pledge: csvPledge });
    }
  }

  console.log(`Pledge updates for existing members (DB missing, CSV has): ${updates.length}`);
  if (updates.length > 0) {
    console.log('\nWould update pledges (phone_number => yearly_pledge):');
    updates.forEach((u) => {
      console.log(`${u.phone_number} => ${u.yearly_pledge}`);
    });
  }

  // Preview first few candidates
  console.log('\nPreview of first 5 would-be inserts:');
  candidates.slice(0, 5).forEach((c, idx) => {
    console.log(`${idx + 1}. ${c.first_name} ${c.middle_name || ''} ${c.last_name} - ${c.phone_number}${c.spouse_name ? ` (spouse: ${c.spouse_name})` : ''}`);
  });

  if (!commit) {
    console.log('\nDry-run complete. No changes were made.');
    await sequelize.close();
    return;
  }

  // Commit mode: insert unique candidates only
  let inserted = 0;
  for (const c of candidates) {
    try {
      await Member.create({
        first_name: c.first_name,
        middle_name: c.middle_name,
        last_name: c.last_name,
        phone_number: c.phone_number,
        spouse_name: c.spouse_name,
        is_imported: true,
        // sensible defaults
        household_size: 1,
        role: 'member',
        is_active: true,
        registration_status: 'pending',
        country: 'USA'
      });
      inserted += 1;
    } catch (e) {
      console.error(`❌ Failed to insert ${c.phone_number}:`, e.message);
    }
  }

  // Apply pledge updates
  let updatedPledges = 0;
  for (const u of updates) {
    try {
      await Member.update(
        { yearly_pledge: u.yearly_pledge },
        { where: { phone_number: u.phone_number } }
      );
      updatedPledges += 1;
    } catch (e) {
      console.error(`❌ Failed to update pledge for ${u.phone_number}:`, e.message);
    }
  }

  console.log(`\nInsert complete. Inserted: ${inserted}`);
  console.log(`Pledge updates applied: ${updatedPledges}`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
