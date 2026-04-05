# Ledger Sheets Backup

This export writes `ledger_entries` to Google Sheets in a readable format.

## Environment-Aware Design

Use one Google Drive folder for both environments, but keep separate spreadsheet files:

- Development/local: `Abune Aregawi Ledger Backup - Dev`
- Production: `Abune Aregawi Ledger Backup - Prod`

Each environment points to its own database via its own env file and writes only to its own spreadsheet.

## Env Loading

The export script loads env files in this order:

1. `.env.<NODE_ENV>.local`
2. `.env.<NODE_ENV>`
3. `.env.local`
4. `.env`

Examples:

- local/dev run:
  - `NODE_ENV=development`
  - uses `.env.development` when present
- prod run:
  - `NODE_ENV=production`
  - uses `.env.production` when present

## Required Variables

- `DATABASE_URL`
- `LEDGER_SHEETS_FOLDER_ID`
- `LEDGER_SHEETS_SPREADSHEET_NAME`

Google OAuth credentials:

- `LEDGER_SHEETS_CLIENT_ID`
- `LEDGER_SHEETS_CLIENT_SECRET`
- `LEDGER_SHEETS_REFRESH_TOKEN`

You may also omit the `LEDGER_SHEETS_*` OAuth variables and reuse:

- `GALLERY_DRIVE_CLIENT_ID`
- `GALLERY_DRIVE_CLIENT_SECRET`
- `GALLERY_DRIVE_REFRESH_TOKEN`

Optional:

- `LEDGER_SHEETS_SPREADSHEET_ID`
- `LEDGER_SHEETS_SYNC_PREVIOUS_YEAR`
- `LEDGER_SHEETS_DEFAULT_PERIOD`

## Suggested Env Files

### `.env.development`

```bash
NODE_ENV=development
DATABASE_URL=postgresql://...
LEDGER_SHEETS_FOLDER_ID=your_shared_folder_id
LEDGER_SHEETS_SPREADSHEET_NAME=Abune Aregawi Ledger Backup - Dev
LEDGER_SHEETS_SPREADSHEET_ID=
```

### `.env.production`

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
LEDGER_SHEETS_FOLDER_ID=your_shared_folder_id
LEDGER_SHEETS_SPREADSHEET_NAME=Abune Aregawi Ledger Backup - Prod
LEDGER_SHEETS_SPREADSHEET_ID=
```

## Manual Export

Preflight check first:

```bash
cd backend
npm run export:ledger:sheets:preflight
```

This validates:

- Google OAuth credentials
- target Drive folder access
- spreadsheet find/create behavior
- the spreadsheet ID you should pin in env after first creation

Export all available years:

```bash
cd backend
npm run export:ledger:sheets
```

Export a single year:

```bash
cd backend
npm run export:ledger:sheets:year -- 2026
```

Dry run:

```bash
cd backend
node src/scripts/export-ledger-to-sheets.js --year 2026 --dry-run
```

Scheduled-run command:

```bash
cd backend
npm run export:ledger:sheets:scheduled
```

## Spreadsheet Layout

One spreadsheet per environment.

One tab per year:

- `2024`
- `2025`
- `2026`

Readable columns include joined member details:

- `Member ID`
- `Member Name`
- `Member Phone Number`

The export uses `ledger_entries` as the base dataset and left joins `members`.

## Scheduling Recommendation

Do not run this inside the main API server.

Recommended:

- run this script from an external scheduler
- weekly by default
- rewrite the current year tab each run
- optionally rewrite the previous year tab too

That keeps the spreadsheet updated if member names or phone numbers change.

Suggested cron example:

```bash
0 2 * * 0 cd /path/to/repo/backend && NODE_ENV=production npm run export:ledger:sheets:scheduled >> /var/log/ledger-sheets-export.log 2>&1
```
