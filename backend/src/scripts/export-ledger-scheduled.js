'use strict';

const { loadLedgerSheetsEnv, getLedgerSheetsConfig } = require('../jobs/ledgerSheets/config');

async function main() {
  loadLedgerSheetsEnv();
  const config = getLedgerSheetsConfig();

  if (!config.exportEnabled) {
    console.log('Ledger Sheets scheduled export is disabled. Set LEDGER_SHEETS_EXPORT_ENABLED=true to enable it.');
    process.exit(0);
  }

  const { exportLedgerToSheets } = require('../jobs/ledgerSheets/ledgerExportService');

  const currentYear = new Date().getFullYear();
  const years = [currentYear];
  if (config.syncPreviousYear) {
    years.unshift(currentYear - 1);
  }

  console.log(`Running scheduled ledger export for environment: ${config.environment}`);
  console.log(`Years selected: ${years.join(', ')}`);

  const result = await exportLedgerToSheets({
    config,
    years,
    dryRun: false,
    logger: console
  });

  console.log('Scheduled export complete.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Scheduled ledger export failed:', error.message);
  process.exit(1);
});
