'use strict';

/**
 * Sales tax policy for event merchandise.
 *
 * ── READ THIS BEFORE CHANGING THE DEFAULT ──────────────────────────────────
 * A Texas nonprofit's SALES of merchandise are not automatically exempt from
 * sales tax just because the seller is a church. Texas does provide relief in
 * specific circumstances — notably the two one-day tax-free sale days an
 * exempt organization may claim per calendar year, and certain qualifying
 * fundraiser rules — but whether a given event qualifies is a determination
 * about THIS event, not a property of the organization.
 *
 * So the default here CHARGES tax. Assuming exemption and being wrong means
 * the church owes uncollected tax out of its own funds; charging when exempt
 * is a refund. The safer error is the recoverable one.
 *
 * Church admins: confirm the rate and the exemption question with the parish
 * treasurer or accountant before the event, and set the env vars accordingly.
 * Nothing in this file is tax advice.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * MERCH_TAX_MODE:
 *   'manual'    (default) — apply MERCH_TAX_RATE_BPS ourselves, as a separate
 *                Checkout line. Works with no Stripe Tax setup at all.
 *   'automatic' — hand the calculation to Stripe Tax (`automatic_tax`). More
 *                correct, but the Stripe account must have Stripe Tax enabled
 *                and a Texas registration, or session creation FAILS.
 *   'none'      — charge no tax. Only with a documented exemption for the event.
 *
 * MERCH_TAX_RATE_BPS: rate in basis points (825 = 8.25%). Used by 'manual' only.
 */

// 8.25% — the Texas state rate of 6.25% plus the 2% local maximum that applies
// in Garland. A starting point to be confirmed, not a fact about any event.
const DEFAULT_TAX_RATE_BPS = 825;

const VALID_MODES = ['manual', 'automatic', 'none'];

function getTaxConfig() {
  const rawMode = String(process.env.MERCH_TAX_MODE || '').trim().toLowerCase();

  // An unrecognised mode is a typo, and a typo must not become a silent tax
  // holiday — fall back to the charging default rather than to 'none'.
  let mode = 'manual';
  if (VALID_MODES.includes(rawMode)) {
    mode = rawMode;
  } else if (rawMode) {
    console.warn(
      `⚠️  Unrecognised MERCH_TAX_MODE "${rawMode}"; falling back to 'manual'. ` +
      `Valid modes: ${VALID_MODES.join(', ')}.`
    );
  }

  const rawRate = process.env.MERCH_TAX_RATE_BPS;
  let rateBps = DEFAULT_TAX_RATE_BPS;
  if (rawRate !== undefined && String(rawRate).trim() !== '') {
    rateBps = Number(rawRate);
    // Throwing beats quietly charging nothing: a bad value surfaces on the
    // first checkout attempt rather than after a weekend of untaxed orders.
    if (!Number.isFinite(rateBps) || rateBps < 0 || rateBps > 10000) {
      throw new Error(
        `Invalid MERCH_TAX_RATE_BPS "${rawRate}": expected basis points between 0 and 10000.`
      );
    }
  }

  return { mode, rateBps };
}

/**
 * Tax on a subtotal, in whole cents.
 *
 * Returns 0 for 'automatic' (Stripe Tax computes and adds its own line — doing
 * it here too would charge twice) and for 'none'.
 */
function computeTaxCents(subtotalCents) {
  const { mode, rateBps } = getTaxConfig();
  if (mode !== 'manual') return 0;
  return Math.round((subtotalCents * rateBps) / 10000);
}

module.exports = { getTaxConfig, computeTaxCents, DEFAULT_TAX_RATE_BPS, VALID_MODES };
