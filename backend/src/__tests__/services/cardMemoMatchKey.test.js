'use strict';

/**
 * Match keys for card purchases.
 *
 * A learned expense mapping is only useful if the same merchant produces the
 * same key next month. Chase card descriptions carry a per-transaction tail
 * the merchant does not — an auth reference and the posting date — so leaving
 * those in the key learns a mapping that can never match again, and the charge
 * is never recognized the second time.
 *
 * The descriptions here follow the real Chase format but name no member: card
 * purchases run church -> merchant.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';

const { getBankMatchKeys } = require('../../services/bankMemoMatchService');

const card = (description) => ({ type: 'DEBIT_CARD', description, payer_name: null });
const keyOf = (txn) => getBankMatchKeys(txn).map((k) => k.matchKey);

describe('card purchase match keys', () => {
  it('gives the same merchant the same key in different months', () => {
    const september = keyOf(card('Spectrum 855-707-7328 MO                     09/28'));
    const october = keyOf(card('Spectrum 855-707-7328 MO                     10/28'));

    expect(september).toEqual(october);
    expect(september[0]).toContain('SPECTRUM');
    // The posting date is what used to make every month unique.
    expect(september[0]).not.toMatch(/\d{2} \d{2}$/);
  });

  it('ignores the per-transaction auth reference', () => {
    const first = keyOf(card('THE HOME DEPOT #0550 DALLAS TX       002096  05/15'));
    const second = keyOf(card('THE HOME DEPOT #0550 DALLAS TX       843597  04/03'));
    // Same store, no auth reference at all on this one.
    const third = keyOf(card('THE HOME DEPOT #0550 DALLAS TX               03/20'));

    expect(first).toEqual(second);
    expect(first).toEqual(third);
    expect(first[0]).not.toContain('002096');
  });

  it('ignores an order number glued to the merchant name', () => {
    const first = keyOf(card('DNH*GODADDY#4038200691 480-5058855 AZ        03/18'));
    const second = keyOf(card('DNH*GODADDY#3991904310 480-5058855 AZ        07/22'));

    expect(first).toEqual(second);
    expect(first[0]).toContain('GODADDY');
  });

  it('keeps different stores of one chain apart', () => {
    // A hardware chain's charges split across categories by location and trip,
    // so collapsing store numbers would learn one GL code for all of them.
    const dallas = keyOf(card('THE HOME DEPOT #0550 DALLAS TX       002096  05/15'));
    const mesquite = keyOf(card('THE HOME DEPOT #6537 MESQUITE TX             03/20'));

    expect(dallas).not.toEqual(mesquite);
  });

  it('keeps different merchants apart', () => {
    const spectrum = keyOf(card('Spectrum 855-707-7328 MO                     09/28'));
    const zoom = keyOf(card('ZOOM.COM 888-799-9666 ZOOM.US CA             09/18'));

    expect(spectrum).not.toEqual(zoom);
  });

  it('does not keep a phone number apart from its merchant', () => {
    // The phone is part of the merchant's identity and never varies; only a
    // digit run the description ENDS on is a transaction reference.
    const key = keyOf(card('Spectrum 855-707-7328 MO                     09/28'))[0];
    expect(key).toContain('855 707 7328');
  });
});

describe('non-card match keys are unchanged', () => {
  // These keys are already stored in bank_memo_matches (422 rows) and
  // expense_memo_matches. Changing how they are built would orphan every
  // learned mapping, so they are pinned byte-for-byte.
  it('leaves ACH keys alone', () => {
    const keys = getBankMatchKeys({
      type: 'ACH_DEBIT',
      description: 'ORIG CO NAME:ACME UTILITY CO ORIG ID:1234 WEB ID:X TRACE#00123',
      payer_name: null
    });
    expect(keys.map((k) => k.matchKey)).toEqual([
      'ACH:DESCRIPTION:ACME UTILITY CO ORIG ID 1234'
    ]);
  });

  it('leaves Zelle keys alone', () => {
    const keys = getBankMatchKeys({
      type: 'ZELLE',
      description: 'Zelle payment from SAMPLE DONOR 27250625041',
      payer_name: 'SAMPLE DONOR'
    });
    expect(keys.map((k) => k.matchKey)).toEqual([
      'ZELLE:PAYER:SAMPLE DONOR',
      'ZELLE:DESCRIPTION:SAMPLE DONOR'
    ]);
  });

  it('leaves check keys alone', () => {
    const keys = getBankMatchKeys({
      type: 'CHECK',
      description: 'CHECK 1582',
      payer_name: null
    });
    expect(keys.map((k) => k.matchKey)).toEqual([]);
  });
});
