const { parseCandidatesFromMessage } = require('../../src/services/gmailZelleIngest');

// Synthetic Chase-shaped message; no real payer data.
function message({ internalDate, dateHeader } = {}) {
  const headers = [
    { name: 'Subject', value: 'You received money with Zelle®' },
    { name: 'From', value: 'Chase <no.reply.alerts@chase.com>' },
    { name: 'Message-Id', value: '<synthetic-1@example.com>' }
  ];
  if (dateHeader) headers.push({ name: 'Date', value: dateHeader });
  return {
    id: 'gmail-synthetic-1',
    internalDate,
    snippet: 'Zelle ® payment JANE SAMPLE sent you money Here are the details: Amount $50.00 Transaction number 12345678901',
    payload: { headers, parts: [] }
  };
}

describe('parseCandidatesFromMessage: email received time', () => {
  test('keeps the full Gmail arrival instant, and its Chicago date', () => {
    // 2026-08-05 03:30 UTC is still Aug 4 in Chicago.
    const internal = Date.parse('2026-08-05T03:30:00Z');
    const parsed = parseCandidatesFromMessage(message({ internalDate: String(internal) }));

    expect(parsed.emailReceivedAt.toISOString()).toBe('2026-08-05T03:30:00.000Z');
    expect(parsed.payment_date).toBe('2026-08-04');
  });

  test('falls back to the Date header when internalDate is missing', () => {
    const parsed = parseCandidatesFromMessage(message({ dateHeader: 'Wed, 05 Aug 2026 14:10:00 -0500' }));
    expect(parsed.emailReceivedAt.toISOString()).toBe('2026-08-05T19:10:00.000Z');
  });

  test('records no time rather than the sync time when neither is present', () => {
    const parsed = parseCandidatesFromMessage(message());
    expect(parsed.emailReceivedAt).toBeNull();
  });
});
