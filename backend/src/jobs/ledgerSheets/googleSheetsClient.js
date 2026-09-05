'use strict';

const { google } = require('googleapis');

const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

function createOAuthClient(config) {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error(
      'Missing Google OAuth credentials. Set LEDGER_SHEETS_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN or reuse GALLERY_DRIVE_* variables.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });
  return oauth2Client;
}

function createClients(config) {
  const auth = createOAuthClient(config);
  return {
    auth,
    drive: google.drive({ version: 'v3', auth }),
    sheets: google.sheets({ version: 'v4', auth })
  };
}

async function findSpreadsheetInFolder(drive, folderId, spreadsheetName) {
  if (!folderId) {
    return null;
  }

  const response = await drive.files.list({
    q: [
      `'${folderId}' in parents`,
      `name = '${spreadsheetName.replace(/'/g, "\\'")}'`,
      `mimeType = '${SPREADSHEET_MIME}'`,
      'trashed = false'
    ].join(' and '),
    fields: 'files(id, name)',
    pageSize: 5
  });

  return response.data.files && response.data.files.length > 0 ? response.data.files[0] : null;
}

async function createSpreadsheetInFolder(drive, spreadsheetName, folderId) {
  const response = await drive.files.create({
    requestBody: {
      name: spreadsheetName,
      mimeType: SPREADSHEET_MIME,
      ...(folderId ? { parents: [folderId] } : {})
    },
    fields: 'id, name, webViewLink'
  });

  return response.data;
}

async function getFolderMetadata(drive, folderId) {
  if (!folderId) {
    return null;
  }

  const response = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType,webViewLink'
  });

  return response.data;
}

async function getOrCreateSpreadsheet(clients, config) {
  if (config.spreadsheetId) {
    return {
      spreadsheetId: config.spreadsheetId,
      spreadsheetName: config.spreadsheetName,
      created: false
    };
  }

  const existing = await findSpreadsheetInFolder(clients.drive, config.folderId, config.spreadsheetName);
  if (existing) {
    return {
      spreadsheetId: existing.id,
      spreadsheetName: existing.name,
      created: false
    };
  }

  const created = await createSpreadsheetInFolder(clients.drive, config.spreadsheetName, config.folderId);
  return {
    spreadsheetId: created.id,
    spreadsheetName: created.name,
    created: true,
    webViewLink: created.webViewLink
  };
}

async function getSpreadsheetMetadata(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties.title,sheets.properties'
  });
  return response.data;
}

async function validateSpreadsheetAccess(sheets, spreadsheetId) {
  const metadata = await getSpreadsheetMetadata(sheets, spreadsheetId);
  return {
    spreadsheetId: metadata.spreadsheetId,
    spreadsheetName: metadata.properties?.title || ''
  };
}

async function ensureSheetExists(sheets, spreadsheetId, title) {
  const metadata = await getSpreadsheetMetadata(sheets, spreadsheetId);
  const existing = (metadata.sheets || []).find((sheet) => sheet.properties.title === title);
  if (existing) {
    return existing.properties;
  }

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title }
          }
        }
      ]
    }
  });

  return response.data.replies[0].addSheet.properties;
}

async function removeDefaultSheetIfUnused(sheets, spreadsheetId, allowedTitles) {
  const metadata = await getSpreadsheetMetadata(sheets, spreadsheetId);
  const defaultSheet = (metadata.sheets || []).find((sheet) => sheet.properties.title === 'Sheet1');
  if (!defaultSheet) {
    return;
  }

  const nonDefaultSheets = (metadata.sheets || []).filter((sheet) => sheet.properties.title !== 'Sheet1');
  if (nonDefaultSheets.length === 0) {
    return;
  }

  if (allowedTitles.has('Sheet1')) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteSheet: {
            sheetId: defaultSheet.properties.sheetId
          }
        }
      ]
    }
  });
}

async function writeSheetValues(sheets, spreadsheetId, sheetTitle, values) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetTitle}'!A:ZZ`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values
    }
  });
}

async function formatSheet(sheets, spreadsheetId, sheetId, rowCount, columnCount) {
  const requests = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1
          }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true
            },
            backgroundColor: {
              red: 0.92,
              green: 0.95,
              blue: 0.98
            }
          }
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)'
      }
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max(rowCount, 1),
            startColumnIndex: 0,
            endColumnIndex: columnCount
          }
        }
      }
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: Math.max(rowCount, 2),
          startColumnIndex: 5,
          endColumnIndex: 6
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'CURRENCY',
              pattern: '$#,##0.00'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    }
  ];

  for (let i = 0; i < columnCount; i += 1) {
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: i,
          endIndex: i + 1
        }
      }
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

module.exports = {
  createClients,
  ensureSheetExists,
  formatSheet,
  getFolderMetadata,
  getOrCreateSpreadsheet,
  getSpreadsheetMetadata,
  removeDefaultSheetIfUnused,
  validateSpreadsheetAccess,
  writeSheetValues
};
