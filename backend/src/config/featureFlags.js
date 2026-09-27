/**
 * Runtime feature flags, read from the environment at call time so they can
 * be flipped without a code change (and toggled inside tests).
 */

/**
 * When false (the default), the Gmail Zelle sync never creates transactions,
 * and the legacy reconcile/create-transaction endpoints return 403. It does
 * not gate the treasurer's Create on Zelle Review
 * (POST /api/zelle/queue/:id/create-transaction), which is always available.
 */
function isZelleGmailCreateEnabled() {
  return String(process.env.ZELLE_GMAIL_CREATE_ENABLED || '').toLowerCase() === 'true';
}

module.exports = { isZelleGmailCreateEnabled };
