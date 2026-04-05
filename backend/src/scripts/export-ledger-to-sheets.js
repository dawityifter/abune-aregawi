'use strict';

const { loadLedgerSheetsEnv, getLedgerSheetsConfig } = require('../jobs/ledgerSheets/config');

function parseArgs(argv) {
  const parsed = {
    years: [],
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--year') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value after --year');
      }
      parsed.years.push(Number(next));
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (/^\d{4}$/.test(arg)) {
      parsed.years.push(Number(arg));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log('Ledger to Google Sheets export');
  console.log('');
  console.log('Usage:');
  console.log('  node src/scripts/export-ledger-to-sheets.js');
  console.log('  node src/scripts/export-ledger-to-sheets.js --year 2026');
  console.log('  node src/scripts/export-ledger-to-sheets.js 2026 --dry-run');
  console.log('');
  console.log('Environment loading order:');
  console.log('  .env.<NODE_ENV>.local, .env.<NODE_ENV>, .env.local, .env');
}

async function main() {
  loadLedgerSheetsEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const config = getLedgerSheetsConfig();
  const { exportLedgerToSheets } = require('../jobs/ledgerSheets/ledgerExportService');

  console.log(`Ledger Sheets export environment: ${config.environment}`);
  console.log(`Target spreadsheet name: ${config.spreadsheetName}`);
  console.log(`Target folder ID set: ${config.folderId ? 'yes' : 'no'}`);
  console.log(`Target spreadsheet ID set: ${config.spreadsheetId ? 'yes' : 'no'}`);
  console.log(`Dry run: ${args.dryRun ? 'yes' : 'no'}`);

  const result = await exportLedgerToSheets({
    config,
    years: args.years,
    dryRun: args.dryRun,
    logger: console
  });

  console.log('Export complete.');
  console.log(JSON.stringify(result, null, 2));

  if (result.created) {
    console.log('');
    console.log('Save this in your env file so future runs always target the same spreadsheet:');
    console.log(`LEDGER_SHEETS_SPREADSHEET_ID=${result.spreadsheetId}`);
  }
}

main().catch((error) => {
  console.error('Ledger Sheets export failed:', error.message);
  process.exit(1);
});
