/**
 * One-time backfill: fills zelle_email_queue.email_received_at for rows
 * recorded before the column existed, so the Zelle Review screen can order
 * same-day payments newest first.
 *
 * Asks Gmail for each row's message (by the stored gmail_id) and uses its
 * internalDate — the same value the sync now records. Rows with no gmail_id,
 * or whose message Gmail can no longer find, are listed and left alone; they
 * still sort correctly by date, just not within the day.
 *
 * Only touches rows where email_received_at is null, so a second run is a
 * no-op.
 *
 * Dry run by default. From backend/:
 *   node scripts/backfill-zelle-email-received-at.js            # report only
 *   node scripts/backfill-zelle-email-received-at.js --apply    # write
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { google } = require('googleapis');
const { ZelleEmailQueue, sequelize } = require('../src/models');
const { getOAuth2Client } = require('../src/services/gmailZelleIngest');

async function main() {
  const apply = process.argv.includes('--apply');
  const gmail = google.gmail({ version: 'v1', auth: getOAuth2Client() });

  const rows = await ZelleEmailQueue.findAll({
    where: { email_received_at: null },
    order: [['payment_date', 'DESC']]
  });

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${rows.length} queue row(s) without a received time\n`);

  let filled = 0;
  for (const row of rows) {
    const label = `queue row ${row.id} (${row.payment_date || 'no date'})`;

    if (!row.gmail_id) {
      console.log(`SKIP ${label}: no Gmail message id`);
      continue;
    }

    let internalDate;
    try {
      const { data } = await gmail.users.messages.get({ userId: 'me', id: row.gmail_id, format: 'minimal' });
      internalDate = Number(data.internalDate);
    } catch (err) {
      console.log(`SKIP ${label}: Gmail lookup failed — ${err.message}`);
      continue;
    }
    if (!Number.isFinite(internalDate) || internalDate <= 0) {
      console.log(`SKIP ${label}: Gmail returned no internalDate`);
      continue;
    }

    const receivedAt = new Date(internalDate);
    if (!apply) {
      console.log(`WOULD SET ${label}: ${receivedAt.toISOString()}`);
      continue;
    }

    await row.update({ email_received_at: receivedAt });
    console.log(`SET ${label}: ${receivedAt.toISOString()}`);
    filled += 1;
  }

  if (apply) console.log(`\nDone: ${filled} row(s) filled.`);
  else console.log('\nNothing changed. Re-run with --apply to write the times marked WOULD SET.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
