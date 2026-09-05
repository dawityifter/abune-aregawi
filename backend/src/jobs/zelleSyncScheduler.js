/**
 * Background poller for Zelle Gmail sync.
 *
 * Enabled with:
 *   ZELLE_SYNC_ENABLED=true
 *   ZELLE_SYNC_INTERVAL_MINUTES=15   (optional, default 15, min 5)
 * Requires the Gmail OAuth env vars used by gmailZelleIngest
 * (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN).
 */
const { syncZelleFromGmail } = require('../services/gmailZelleIngest');

let running = false;
let timer = null;

async function runZelleSync(logger = console) {
  if (running) {
    logger.log('Zelle sync already running, skipping this tick');
    return;
  }
  running = true;
  try {
    const stats = await syncZelleFromGmail({ dryRun: false });
    logger.log(
      `Zelle sync completed: scanned=${stats.scanned} autoCreated=${stats.autoCreated} ` +
      `needsReview=${stats.needsReview} skipped=${stats.skipped} errors=${stats.errors}`
    );
  } catch (error) {
    logger.error('Zelle sync failed:', error.message || error);
  } finally {
    running = false;
  }
}

function startZelleSyncScheduler(logger = console) {
  const enabled = String(process.env.ZELLE_SYNC_ENABLED || '').toLowerCase() === 'true';
  if (!enabled) {
    logger.log('Zelle sync scheduler disabled (set ZELLE_SYNC_ENABLED=true to enable)');
    return null;
  }
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    logger.warn('Zelle sync scheduler not started: missing Gmail OAuth env vars');
    return null;
  }

  const minutes = Math.max(Number(process.env.ZELLE_SYNC_INTERVAL_MINUTES) || 15, 5);
  logger.log(`Starting Zelle sync scheduler (every ${minutes} minutes)`);

  // Kick off one run shortly after boot, then poll on the interval
  setTimeout(() => runZelleSync(logger), 30 * 1000);
  timer = setInterval(() => runZelleSync(logger), minutes * 60 * 1000);
  if (timer.unref) timer.unref();
  return timer;
}

function stopZelleSyncScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startZelleSyncScheduler, stopZelleSyncScheduler, runZelleSync };
