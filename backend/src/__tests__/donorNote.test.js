'use strict';
const { buildDonorNote, DONOR_MARKER } = require('../utils/donorNote');

describe('buildDonorNote', () => {
  it('returns the note untouched when no donor detail is supplied', () => {
    expect(buildDonorNote('Sunday offering', {})).toBe('Sunday offering');
    expect(buildDonorNote('Sunday offering')).toBe('Sunday offering');
  });

  it('returns an empty string when there is neither a note nor donor detail', () => {
    expect(buildDonorNote(null, {})).toBe('');
    expect(buildDonorNote(undefined, {})).toBe('');
  });

  it('builds the block from a name alone', () => {
    expect(buildDonorNote(null, { donor_name: 'newaye kidusan' }))
      .toBe('[Anonymous Donor]\nName: newaye kidusan');
  });

  it('puts the donor block above the original note, separated by a blank line', () => {
    expect(buildDonorNote('Paid at the door', { donor_name: 'Jane Visitor' }))
      .toBe('[Anonymous Donor]\nName: Jane Visitor\n\nPaid at the door');
  });

  it('preserves the historical field order', () => {
    const result = buildDonorNote(null, {
      donor_memo: 'in memory of',
      donor_phone: '+15550001111',
      donor_email: 'jane@example.org',
      donor_name: 'Jane Visitor',
      donor_type: 'individual'
    });

    expect(result).toBe([
      '[Anonymous Donor]',
      'Type: individual',
      'Name: Jane Visitor',
      'Email: jane@example.org',
      'Phone: +15550001111',
      'Memo: in memory of'
    ].join('\n'));
  });

  it('omits fields that are absent or empty', () => {
    expect(buildDonorNote(null, { donor_name: 'Jane', donor_email: '', donor_phone: null }))
      .toBe('[Anonymous Donor]\nName: Jane');
  });

  it('emits a marker the frontend parser can find', () => {
    const note = buildDonorNote('x', { donor_name: 'Jane' });
    expect(note).toContain(DONOR_MARKER);
    // parseDonorInfo splits on newlines and matches a line starting with "Name:"
    expect(note.split('\n').some(l => l.startsWith('Name:'))).toBe(true);
  });
});
