# Ledger Export and Sync to Google Sheets Guide

## Purpose

This feature sends church ledger data from the application database to a Google Sheet so finance records can be reviewed, shared, and backed up outside the app.

It is designed for:

- `admin` users
- `treasurer` users

The Ledger Backup screen lets authorized users:

- run a full export of all available ledger years
- sync the current year on demand
- optionally sync the previous year too
- enable a recurring daily or weekly sync schedule
- view the last run result and the target spreadsheet

## What the Feature Does

The export creates or updates one Google spreadsheet for the current environment.

- Production writes to the production ledger spreadsheet
- Development writes to the development ledger spreadsheet

Inside that spreadsheet:

- each year is stored in its own tab
- the tab name is the year, such as `2024`, `2025`, or `2026`
- each run rewrites the sheet content for the years being exported so the Google Sheet stays current

This is useful because:

- it gives the church a readable ledger backup outside the app
- it allows finance leaders to review records in Google Sheets
- it keeps exported rows aligned with the latest member information included in the export

## What "Full Export" and "Sync" Mean

### Run Full Export

`Run Full Export` exports all years that currently exist in the ledger data.

Use this when:

- setting up the feature for the first time
- rebuilding the spreadsheet from scratch
- verifying that all historical years are present

Expected result:

- all available years get their own tabs
- each tab is refreshed with current data from the database

### Sync Now

`Sync Now` is a smaller operational sync.

It exports:

- the current year
- the previous year too, if `Also sync the previous year tab` is enabled

Use this when:

- new ledger entries were added and you want Sheets updated immediately
- corrections were made and you want the Google Sheet refreshed
- you do not need a full historical rebuild

### Scheduled Sync

Scheduled sync runs automatically from the backend server.

Important behavior:

- the server checks once per minute whether a run is due
- the schedule uses `America/Chicago`
- only the environment with scheduler enabled should own the recurring job

This means production should normally be the only environment with scheduled sync turned on.

## What Users Will See in the UI

In the Treasurer Dashboard, the `Ledger Backup` screen shows four main status areas.

### 1. Environment

This shows whether the screen is connected to:

- `Prod`
- `Dev`
- `Test`

Users should confirm they are working in the correct environment before running exports.

### 2. Spreadsheet

This shows:

- the configured spreadsheet name
- a link to open the spreadsheet if an ID is already known

Users should check that the spreadsheet name matches the expected environment.

### 3. Google Access

This shows two setup checks:

- `OAuth: Configured` or `Missing`
- `Folder: Configured` or `Missing`

Both must be configured for the feature to work correctly.

### 4. Last Run

This shows:

- whether the last run succeeded, failed, or is running
- whether it was a `full`, `sync`, or `scheduled` run
- the last completed date and time
- the last error, if one occurred

This is the first place to check when a user says the spreadsheet did not update.

## Requirements

The feature depends on three groups of requirements.

### 1. Backend feature flag

The backend must have ledger export enabled:

- `LEDGER_SHEETS_EXPORT_ENABLED=true`

If this is not enabled:

- scheduled sync will not run
- the server will report scheduler unavailable

### 2. Google Drive and Google Sheets access

The backend must be able to authenticate to Google and access the destination Drive folder.

Required:

- a Google Drive folder ID
- Google OAuth credentials with access to Sheets and Drive

The app supports either:

- dedicated `LEDGER_SHEETS_*` OAuth credentials
- or reuse of the existing `GALLERY_DRIVE_*` OAuth credentials

### 3. Spreadsheet destination

The feature needs a spreadsheet target.

You can provide either:

- a known spreadsheet ID with `LEDGER_SHEETS_SPREADSHEET_ID`
- or a spreadsheet name and folder so the system can find or create it automatically

If the spreadsheet is created automatically the app logs the new spreadsheet ID, and that ID should then be saved in env or GitHub Secrets for stability.

## Required Environment Variables

These are the main values that should be configured for production.

### Required for feature setup

- `LEDGER_SHEETS_EXPORT_ENABLED=true`
- `LEDGER_SHEETS_ENV=production`
- `LEDGER_SHEETS_FOLDER_ID=<google_drive_folder_id>`
- `LEDGER_SHEETS_SPREADSHEET_NAME=Abune Aregawi Ledger Backup - Prod`

### Strongly recommended

- `LEDGER_SHEETS_SPREADSHEET_ID=<existing_or_created_spreadsheet_id>`
- `LEDGER_SHEETS_SYNC_PREVIOUS_YEAR=true`
- `LEDGER_SHEETS_DEFAULT_PERIOD=weekly`

### Google OAuth

One of these sets must be available:

- `LEDGER_SHEETS_CLIENT_ID`
- `LEDGER_SHEETS_CLIENT_SECRET`
- `LEDGER_SHEETS_REFRESH_TOKEN`

Or:

- `GALLERY_DRIVE_CLIENT_ID`
- `GALLERY_DRIVE_CLIENT_SECRET`
- `GALLERY_DRIVE_REFRESH_TOKEN`

## GitHub Secrets Needed for Deployment

For the current deployment workflow, these ledger settings are expected from GitHub Secrets:

- `LEDGER_SHEETS_EXPORT_ENABLED`
- `LEDGER_SHEETS_ENV`
- `LEDGER_SHEETS_FOLDER_ID`
- `LEDGER_SHEETS_SPREADSHEET_NAME`
- `LEDGER_SHEETS_SPREADSHEET_ID`
- `LEDGER_SHEETS_SYNC_PREVIOUS_YEAR`
- `LEDGER_SHEETS_DEFAULT_PERIOD`

With the current implementation, Google OAuth can continue using the already-existing gallery Drive secrets.

## Recommended First-Time Setup

### Step 1. Configure the environment

Make sure the production environment has:

- ledger export enabled
- the correct environment label
- a valid Drive folder ID
- working Google OAuth credentials

### Step 2. Open the Ledger Backup screen

Go to the Treasurer Dashboard and open `Ledger Backup`.

Confirm:

- `Environment` is correct
- `OAuth` shows `Configured`
- `Folder` shows `Configured`

If either Google check says `Missing`, stop there and fix configuration first.

### Step 3. Run a full export

Click `Run Full Export`.

This is the best first-run action because it creates all available year tabs and proves end-to-end connectivity.

### Step 4. Open the spreadsheet

After the export completes:

- open the spreadsheet link if it is shown
- verify that tabs exist for the expected years
- open a few rows and confirm the ledger data looks correct

### Step 5. Save the spreadsheet ID

If the sheet was newly created and the spreadsheet ID was previously blank:

- copy the created spreadsheet ID from logs or the opened URL
- save it into the deployment secret or environment variable for `LEDGER_SHEETS_SPREADSHEET_ID`

This prevents future ambiguity if multiple files with similar names exist.

### Step 6. Configure schedule

Choose:

- daily or weekly frequency
- day of week if weekly
- time in Central time
- whether the previous year should also be synced

Then click `Save Schedule`.

## How to Decide Between Daily and Weekly

Use `weekly` when:

- ledger changes are not happening every day
- the spreadsheet is mainly for backup and periodic review
- you want a lighter operational cadence

Use `daily` when:

- finance records are updated frequently
- the spreadsheet is actively used for current operational review

For most churches, `weekly` is a sensible default.

## What to Look For After Setup

After setup, users should regularly confirm the following:

- the spreadsheet opens successfully
- current-year data is updating as expected
- the last run status is `success`
- the next run time is populated when schedule is enabled
- the correct years are being updated

If `syncPreviousYear` is enabled, users should also check that the prior year tab continues to receive updates.

## Recommended Operating Pattern

Use this pattern in production:

1. Run `Full Export` during initial setup
2. Confirm the spreadsheet and year tabs
3. Save schedule as `weekly`
4. Use `Sync Now` whenever urgent updates need to appear immediately
5. Use `Full Export` only when rebuilding or validating the full archive

## Common Troubleshooting

### Problem: Google Access shows Missing

Likely causes:

- missing OAuth credentials
- missing folder ID
- wrong secret names in deployment

What to check:

- GitHub Secrets names
- deployed `.env` values
- whether the OAuth credentials still have Drive and Sheets access

### Problem: No spreadsheet opens

Likely causes:

- `LEDGER_SHEETS_SPREADSHEET_ID` is empty
- the sheet has not been created yet
- the configured spreadsheet ID is wrong

What to do:

- run `Full Export`
- check logs for the created spreadsheet ID
- save that ID into configuration

### Problem: Scheduled sync never runs

Likely causes:

- `LEDGER_SHEETS_EXPORT_ENABLED` is not `true`
- schedule was never enabled in the UI
- the wrong environment is expected to own the job

What to check:

- `Server Scheduler Enabled` status
- saved schedule settings
- backend server uptime and logs

### Problem: Last run failed

What to check first:

- the `Last error` message in the Ledger Backup screen
- backend logs around the run time
- Google folder access
- OAuth credential validity

### Problem: The sheet is missing an older year

Possible reason:

- `Sync Now` updates only the current year, and optionally the previous year

What to do:

- use `Run Full Export` to rebuild all available years

## Notes for Administrators

- The schedule is stored in the application database, not only in env
- The server scheduler runs inside the backend process
- Only one ledger export can run at a time
- The feature writes data into Google Sheets but does not replace the application database as the system of record

## Quick Reference

### Best first action

- Run `Full Export`

### Best ongoing action

- Use `Sync Now` for immediate refreshes

### Best default schedule

- `weekly`

### Best production env values

- `LEDGER_SHEETS_EXPORT_ENABLED=true`
- `LEDGER_SHEETS_ENV=production`
- `LEDGER_SHEETS_SYNC_PREVIOUS_YEAR=true`
- `LEDGER_SHEETS_DEFAULT_PERIOD=weekly`

### Most important checks in the UI

- `Google Access`
- `Last Run`
- `Next run`
- spreadsheet link and year tabs
