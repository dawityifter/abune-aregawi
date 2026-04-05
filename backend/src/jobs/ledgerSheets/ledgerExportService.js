'use strict';

const {
  createClients,
  ensureSheetExists,
  formatSheet,
  getOrCreateSpreadsheet,
  removeDefaultSheetIfUnused,
  writeSheetValues
} = require('./googleSheetsClient');
const { fetchLedgerEntriesForYear, listAvailableYears } = require('./ledgerExportQuery');
const { HEADERS, toSheetValues } = require('./ledgerSheetFormatter');

async function exportLedgerToSheets({
  config,
  years,
  dryRun = false,
  logger = console
}) {
  const targetYears = years && years.length > 0 ? years : await listAvailableYears();
  if (targetYears.length === 0) {
    logger.log('No ledger entries found. Nothing to export.');
    return { spreadsheetId: config.spreadsheetId || '', exportedYears: [] };
  }

  const clients = createClients(config);
  const spreadsheet = await getOrCreateSpreadsheet(clients, config);

  logger.log(`Using spreadsheet: ${spreadsheet.spreadsheetName} (${spreadsheet.spreadsheetId})`);
  if (spreadsheet.created) {
    logger.log('Spreadsheet was newly created. Save this ID in your env file:');
    logger.log(`LEDGER_SHEETS_SPREADSHEET_ID=${spreadsheet.spreadsheetId}`);
  }

  const exportedYears = [];
  const allowedTitles = new Set(targetYears.map(String));

  for (const year of targetYears) {
    const sheetTitle = String(year);
    const entries = await fetchLedgerEntriesForYear(year);
    const values = toSheetValues(entries);

    logger.log(`[${config.environment}] ${sheetTitle}: ${entries.length} ledger rows ready for export`);

    if (!dryRun) {
      const sheetProps = await ensureSheetExists(clients.sheets, spreadsheet.spreadsheetId, sheetTitle);
      await writeSheetValues(clients.sheets, spreadsheet.spreadsheetId, sheetTitle, values);
      await formatSheet(
        clients.sheets,
        spreadsheet.spreadsheetId,
        sheetProps.sheetId,
        values.length,
        HEADERS.length
      );
    }

    exportedYears.push({
      year,
      rowCount: entries.length
    });
  }

  if (!dryRun) {
    await removeDefaultSheetIfUnused(clients.sheets, spreadsheet.spreadsheetId, allowedTitles);
  }

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetName: spreadsheet.spreadsheetName,
    created: spreadsheet.created,
    exportedYears
  };
}

module.exports = {
  exportLedgerToSheets
};
