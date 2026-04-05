'use strict';

const { loadLedgerSheetsEnv, getLedgerSheetsConfig } = require('../jobs/ledgerSheets/config');
const { runLedgerSheetsPreflight } = require('../jobs/ledgerSheets/preflight');

function printHelp() {
  console.log('Ledger Sheets preflight');
  console.log('');
  console.log('Usage:');
  console.log('  node src/scripts/preflight-ledger-sheets.js');
  console.log('');
  console.log('Validates Google auth, Drive folder access, and spreadsheet resolution.');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  loadLedgerSheetsEnv();
  const config = getLedgerSheetsConfig();

  console.log(`Ledger Sheets preflight for environment: ${config.environment}`);
  console.log(`Configured spreadsheet name: ${config.spreadsheetName}`);
  console.log(`Configured folder ID: ${config.folderId || '(missing)'}`);

  const result = await runLedgerSheetsPreflight(config, console);

  console.log('Preflight successful.');
  console.log(JSON.stringify(result, null, 2));

  if (result.spreadsheet.created) {
    console.log('');
    console.log('Save this in your env file for future runs:');
    console.log(`LEDGER_SHEETS_SPREADSHEET_ID=${result.spreadsheet.spreadsheetId}`);
  }
}

main().catch((error) => {
  console.error('Ledger Sheets preflight failed:', error.message);
  process.exit(1);
});
