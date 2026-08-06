'use strict';

/**
 * Demo mode lets a hardcoded bearer token stand in for a verified Firebase
 * token, resolving to an admin session. That is useful when walking the board
 * through the app and it is what the integration tests authenticate with, but
 * it is a complete authentication bypass — so production must never honor it,
 * whatever the environment happens to say.
 *
 * The checks live here rather than at each call site because there are four of
 * them (auth middleware, the token-only route guard, the profile lookup, and
 * the frontend), and a bypass whose conditions are copy-pasted is a bypass that
 * eventually drifts.
 */

const DEMO_TOKEN = 'MAGIC_DEMO_TOKEN';
const DEMO_UID = 'magic-demo-uid';

/**
 * The demo identity resolves to a real member row by phone, so the number is
 * overridable rather than fixed in source. Set DEMO_PHONE / DEMO_EMAIL locally
 * to demo as somebody else without editing code.
 */
const DEMO_PHONE = process.env.DEMO_PHONE || '+14699078229';
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@admin.com';

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Production short-circuits before the env var is even read, so no combination
 * of deploy-time configuration can turn the bypass on.
 */
const isDemoModeEnabled = () => !isProduction() && process.env.ENABLE_DEMO_MODE === 'true';

const isDemoToken = (token) => isDemoModeEnabled() && token === DEMO_TOKEN;

const isDemoUid = (uid) => isDemoModeEnabled() && uid === DEMO_UID;

/**
 * Called at startup. A production deploy carrying ENABLE_DEMO_MODE=true is a
 * misconfiguration the operator has to see — silently ignoring the flag would
 * leave them believing a bypass is available when it isn't, or worse, believing
 * they had disabled one when they never had.
 */
function assertDemoModeNotEnabledInProduction() {
  if (isProduction() && process.env.ENABLE_DEMO_MODE === 'true') {
    throw new Error(
      'ENABLE_DEMO_MODE=true is not permitted when NODE_ENV=production. ' +
      'Demo mode bypasses Firebase token verification and grants admin access. ' +
      'Unset ENABLE_DEMO_MODE before deploying.'
    );
  }
}

module.exports = {
  DEMO_TOKEN,
  DEMO_UID,
  DEMO_PHONE,
  DEMO_EMAIL,
  isDemoModeEnabled,
  isDemoToken,
  isDemoUid,
  assertDemoModeNotEnabledInProduction
};
