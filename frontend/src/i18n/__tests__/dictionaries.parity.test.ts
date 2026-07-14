import { en, ti } from '../dictionaries';

/**
 * Regression guard for translation coverage.
 *
 * The app's t() falls back to English whenever a Tigrinya (ti) value is
 * missing, so a missing ti key renders silently as English. These tests
 * freeze the en/ti parity: any new English key must ship with a Tigrinya
 * counterpart, and we surface keys whose ti value is still identical to en
 * (a likely-untranslated placeholder) for manual review.
 */

type Flat = Record<string, string>;

function flatten(obj: any, prefix = '', out: Flat = {}): Flat {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      flatten(value, path, out);
    } else if (typeof value === 'string') {
      out[path] = value;
    }
  }
  return out;
}

const enFlat = flatten(en);
const tiFlat = flatten(ti);

describe('dictionaries en/ti parity', () => {
  it('has a Tigrinya value for every English key', () => {
    const missing = Object.keys(enFlat).filter((k) => !(k in tiFlat));
    expect(missing).toEqual([]);
  });

  it('has no Tigrinya-only keys not present in English', () => {
    const extra = Object.keys(tiFlat).filter((k) => !(k in enFlat));
    expect(extra).toEqual([]);
  });

  it('has no ti values identical to en (excluding known allow-list)', () => {
    // Terms intentionally identical across languages (proper nouns / codes / addresses).
    const allow = new Set<string>([
      'treasurerDashboard.transactionList.methods.credit_card',
      'treasurerDashboard.transactionList.methods.debit_card',
      'treasurerDashboard.transactionList.methods.ach',
      'treasurerDashboard.transactionList.status.pending',
      'church.address',
      'donatePage.auth.methodAch',
    ]);
    const identical = Object.keys(enFlat).filter(
      (k) =>
        k in tiFlat &&
        enFlat[k] === tiFlat[k] &&
        !allow.has(k) &&
        /[a-zA-Z]{2}/.test(enFlat[k]),
    );
    expect(identical).toEqual([]);
  });
});
