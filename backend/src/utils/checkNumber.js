'use strict';

/**
 * Check numbers are the church's outgoing checkbook sequence, so they are
 * numeric by definition. They were historically stored as free text, which let
 * "1593", "CHK-1593" and "01593" coexist as three distinct values that all
 * refer to the same physical check — defeating both the uniqueness rule and the
 * skipped-check audit. Every write now goes through normalizeCheckNumber so the
 * stored form is canonical digits.
 */

/** First check in the church's current checkbook. Gap audits start here. */
const DEFAULT_START_CHECK_NUMBER = 1593;

/**
 * Canonicalize a user- or bank-supplied check number.
 * Accepts an optional leading "#" and surrounding whitespace; everything else
 * must be digits. Returns { ok: true, value } with leading zeros dropped, or
 * { ok: false, reason } for empty / non-numeric / zero input.
 */
function normalizeCheckNumber(raw) {
  const trimmed = String(raw ?? '').trim().replace(/^#\s*/, '').trim();

  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, reason: 'non_numeric' };
  }

  const parsed = parseInt(trimmed, 10);
  if (parsed <= 0) {
    return { ok: false, reason: 'non_positive' };
  }

  return { ok: true, value: String(parsed) };
}

/**
 * Best-effort read of a check number that may be absent or unparseable —
 * used on the bank side, where a row's number comes from a CSV column that is
 * often blank. Returns the canonical string or null; never throws.
 */
function parseCheckNumber(raw) {
  const result = normalizeCheckNumber(raw);
  return result.ok ? result.value : null;
}

module.exports = {
  DEFAULT_START_CHECK_NUMBER,
  normalizeCheckNumber,
  parseCheckNumber
};
