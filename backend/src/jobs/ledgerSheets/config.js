'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadLedgerSheetsEnv() {
  const backendRoot = path.resolve(__dirname, '../../..');
  const nodeEnv = process.env.NODE_ENV || 'development';
  const candidates = [
    path.join(backendRoot, `.env.${nodeEnv}.local`),
    path.join(backendRoot, `.env.${nodeEnv}`),
    path.join(backendRoot, '.env.local'),
    path.join(backendRoot, '.env')
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
}

function classifyEnvironment(rawEnv) {
  if (rawEnv === 'production' || rawEnv === 'prod') {
    return { key: 'production', label: 'Prod' };
  }
  if (rawEnv === 'test') {
    return { key: 'test', label: 'Test' };
  }
  return { key: 'development', label: 'Dev' };
}

function getLedgerSheetsConfig() {
  loadLedgerSheetsEnv();

  const envValue = String(process.env.LEDGER_SHEETS_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const envInfo = classifyEnvironment(envValue);

  const clientId = process.env.LEDGER_SHEETS_CLIENT_ID || process.env.GALLERY_DRIVE_CLIENT_ID;
  const clientSecret = process.env.LEDGER_SHEETS_CLIENT_SECRET || process.env.GALLERY_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.LEDGER_SHEETS_REFRESH_TOKEN || process.env.GALLERY_DRIVE_REFRESH_TOKEN;

  return {
    exportEnabled: String(process.env.LEDGER_SHEETS_EXPORT_ENABLED || 'false').toLowerCase() === 'true',
    environment: envInfo.key,
    environmentLabel: envInfo.label,
    folderId: process.env.LEDGER_SHEETS_FOLDER_ID || '',
    spreadsheetId: process.env.LEDGER_SHEETS_SPREADSHEET_ID || '',
    spreadsheetName: process.env.LEDGER_SHEETS_SPREADSHEET_NAME || `Abune Aregawi Ledger Backup - ${envInfo.label}`,
    syncPreviousYear: String(process.env.LEDGER_SHEETS_SYNC_PREVIOUS_YEAR || 'true').toLowerCase() === 'true',
    defaultPeriod: process.env.LEDGER_SHEETS_DEFAULT_PERIOD || 'weekly',
    clientId,
    clientSecret,
    refreshToken
  };
}

module.exports = {
  getLedgerSheetsConfig,
  loadLedgerSheetsEnv
};
