/**
 * Runtime feature flags, read from the environment at call time so they can
 * be flipped without a code change (and toggled inside tests).
 */

/**
 * When false (the default), the Gmail Zelle path never creates transactions.
 * It only records emails in zelle_email_queue and learns payer->member
 * associations; bank reconciliation is the sole path that posts money.
 */
function isZelleGmailCreateEnabled() {
  return String(process.env.ZELLE_GMAIL_CREATE_ENABLED || '').toLowerCase() === 'true';
}

module.exports = { isZelleGmailCreateEnabled };
