'use strict';

const {
  createClients,
  getFolderMetadata,
  getOrCreateSpreadsheet,
  validateSpreadsheetAccess
} = require('./googleSheetsClient');

async function runLedgerSheetsPreflight(config, logger = console) {
  if (!config.folderId) {
    throw new Error('LEDGER_SHEETS_FOLDER_ID is required for ledger export preflight.');
  }

  const clients = createClients(config);
  const folder = await getFolderMetadata(clients.drive, config.folderId);

  if (!folder) {
    throw new Error('Unable to access the configured Google Drive folder.');
  }

  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`Configured folder ID does not point to a Google Drive folder: ${folder.mimeType}`);
  }

  logger.log(`Google folder resolved: ${folder.name} (${folder.id})`);

  const spreadsheet = await getOrCreateSpreadsheet(clients, config);
  const spreadsheetAccess = await validateSpreadsheetAccess(clients.sheets, spreadsheet.spreadsheetId);

  logger.log(`Spreadsheet resolved: ${spreadsheetAccess.spreadsheetName} (${spreadsheetAccess.spreadsheetId})`);

  return {
    environment: config.environment,
    folder,
    spreadsheet: {
      ...spreadsheet,
      ...spreadsheetAccess
    }
  };
}

module.exports = {
  runLedgerSheetsPreflight
};
