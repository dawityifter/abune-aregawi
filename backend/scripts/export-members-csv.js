#!/usr/bin/env node
/*
  Export members CSV with columns:
  phone_number, member_id, first_name, last_name, spouse_name

  Usage:
    node backend/scripts/export-members-csv.js

  Output:
    members-info-YYYY-MM-dd.csv in the repository root directory
*/

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Use the existing Sequelize setup and models
const { sequelize, Member } = require('../src/models');

function formatDateStamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function main() {
  try {
    // Ensure DB is reachable
    await sequelize.authenticate();

    const members = await Member.findAll({
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'spouse_name'],
      order: [['id', 'ASC']],
      raw: true,
    });

    const header = ['phone_number', 'member_id', 'first_name', 'last_name', 'spouse_name'];
    const rows = [header.join(',')];

    for (const m of members) {
      rows.push([
        csvEscape(m.phone_number || ''),
        csvEscape(m.id),
        csvEscape(m.first_name || ''),
        csvEscape(m.last_name || ''),
        csvEscape(m.spouse_name || ''),
      ].join(','));
    }

    const filename = `members-info-${formatDateStamp()}.csv`;
    // Write to repo root
    const outPath = path.resolve(__dirname, '../../', filename);
    fs.writeFileSync(outPath, rows.join('\n'), 'utf8');

    console.log(`✅ Wrote ${members.length} rows to ${outPath}`);
    await sequelize.close();
  } catch (err) {
    console.error('❌ Failed to export members CSV:', err && err.message ? err.message : err);
    process.exitCode = 1;
    try { await sequelize.close(); } catch (_) {}
  }
}

main();
