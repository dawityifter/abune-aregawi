'use strict';

/**
 * Donor details for a gift with no member_id are recorded as a structured block
 * at the top of the transaction's free-text note:
 *
 *   [Anonymous Donor]
 *   Name: Jane Visitor
 *
 *   <original note, if any>
 *
 * The frontend (TransactionList.parseDonorInfo) reads this back to display the
 * giver on the Member Payments dashboard.
 *
 * The marker is literally "[Anonymous Donor]" even where the UI now says
 * "non-member donor" — every existing row uses that string and the parser keys
 * off it, so renaming it would strand historical records.
 */

const DONOR_MARKER = '[Anonymous Donor]';

// Field order is part of the format: existing rows were written this way.
const FIELDS = [
  ['donor_type', 'Type'],
  ['donor_name', 'Name'],
  ['donor_email', 'Email'],
  ['donor_phone', 'Phone'],
  ['donor_memo', 'Memo']
];

/**
 * Prepends the donor block to `note`. Returns `note` unchanged when no donor
 * detail is supplied, so callers can apply it unconditionally.
 *
 * @param {string|null|undefined} note  the original free-text note
 * @param {object} donor  { donor_type, donor_name, donor_email, donor_phone, donor_memo }
 * @returns {string} the combined note ('' when there is nothing at all)
 */
function buildDonorNote(note, donor = {}) {
  const baseNote = note || '';

  const lines = [];
  for (const [key, label] of FIELDS) {
    const value = donor[key];
    if (value) lines.push(`${label}: ${value}`);
  }

  if (lines.length === 0) return baseNote;

  const donorSection = `${DONOR_MARKER}\n${lines.join('\n')}`;
  return baseNote ? `${donorSection}\n\n${baseNote}` : donorSection;
}

module.exports = { buildDonorNote, DONOR_MARKER };
