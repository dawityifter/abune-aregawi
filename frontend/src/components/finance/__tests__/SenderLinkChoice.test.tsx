import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';
import { BankTransaction } from '../BankTransactionList';
import { payerResembles, senderLinkState } from '../SenderLinkChoice';
import { LanguageProvider, useLanguage } from '../../../contexts/LanguageContext';
import { I18nProvider } from '../../../i18n/I18nProvider';

// "Paid on behalf of" is a fact about one payment, not about the sender.
// All names synthetic.

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

global.fetch = jest.fn();

const renderDetail = (txn: BankTransaction) => render(
  <I18nProvider>
    <LanguageProvider>
      <BankTransactionDetail txn={txn} onClose={jest.fn()} onSuccess={jest.fn()} />
    </LanguageProvider>
  </I18nProvider>
);

const SENDER = { id: 7, first_name: 'Abel', last_name: 'Sender' };
const PLEDGER = { id: 8, first_name: 'Hana', last_name: 'Pledger' };

const baseTxn: BankTransaction = {
  id: 90,
  date: '2026-09-21',
  amount: 300,
  description: 'Zelle payment from ABEL T SENDER 39990000001',
  type: 'ZELLE',
  status: 'PENDING',
  payer_name: 'ABEL T SENDER',
  check_number: null,
};

const learned = (member: typeof SENDER, extra = {}) => ({
  type: 'LEARNED_ZELLE', source: 'LEARNED_ZELLE', reason: 'Previously associated with this ZELLE payer',
  confidence: 'high', member, ...extra,
});
const fuzzy = (member: typeof SENDER) => ({
  type: 'FUZZY_NAME', source: 'FUZZY_NAME', reason: 'resembles', confidence: 'low', member,
});

const approveAndReadBody = async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
  fireEvent.click(screen.getByRole('button', { name: /^Approve$/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('/api/bank/reconcile'));
  return JSON.parse(call[1].body);
};

beforeEach(() => (global.fetch as jest.Mock).mockReset());

describe('payerResembles / senderLinkState', () => {
  test('first and last name must both appear in the payer name', () => {
    expect(payerResembles('ABEL T SENDER', 'Abel Sender')).toBe(true);
    expect(payerResembles('ABEL T SENDER', 'Hana Pledger')).toBe(false);
    expect(payerResembles('ABEL KEBEDE', 'Abel Sender')).toBe(false);
  });

  test('asks unless the sender is already remembered as exactly this member', () => {
    expect(senderLinkState('ABEL T SENDER', { id: 7, name: 'Abel Sender' }, [SENDER]).visible).toBe(false);
    const other = senderLinkState('ABEL T SENDER', { id: 8, name: 'Hana Pledger' }, [SENDER]);
    expect(other).toMatchObject({ visible: true, defaultRemember: false });
    expect(other.others.map((m) => m.id)).toEqual([7]);
    // A new sender whose name matches: remembering is the default.
    expect(senderLinkState('ABEL T SENDER', { id: 7, name: 'Abel Sender' }, []).defaultRemember).toBe(true);
    // A new sender whose name does not match: this payment only.
    expect(senderLinkState('ABEL T SENDER', { id: 8, name: 'Hana Pledger' }, []).defaultRemember).toBe(false);
  });
});

describe('BankTransactionDetail — who is the sender?', () => {
  test('approving a known sender\'s payment for another member defaults to "this payment only"', async () => {
    renderDetail({ ...baseTxn, suggested_matches: [learned(SENDER), fuzzy(PLEDGER)], suggested_match: learned(SENDER) });
    fireEvent.click(screen.getByRole('button', { name: /Hana Pledger/i }));

    expect(screen.getByText(/is remembered as Abel Sender/)).toBeInTheDocument();
    expect(screen.getByLabelText(/This payment only — ABEL T SENDER paid on behalf of Hana Pledger/)).toBeChecked();

    const body = await approveAndReadBody();
    expect(body.member_id).toBe(8);
    expect(body.remember_sender).toBe(false);
  });

  test('"Remember" is sent only when chosen', async () => {
    renderDetail({ ...baseTxn, suggested_matches: [learned(SENDER), fuzzy(PLEDGER)], suggested_match: learned(SENDER) });
    fireEvent.click(screen.getByRole('button', { name: /Hana Pledger/i }));
    fireEvent.click(screen.getByLabelText(/Remember — future payments from ABEL T SENDER are Hana Pledger's/));

    const body = await approveAndReadBody();
    expect(body.remember_sender).toBe(true);
  });

  test('no question, and nothing sent, when the sender is already remembered as this member', async () => {
    renderDetail({ ...baseTxn, suggested_matches: [learned(SENDER)], suggested_match: learned(SENDER) });
    expect(screen.queryByText('Who is the sender?')).not.toBeInTheDocument();

    const body = await approveAndReadBody();
    expect(body.member_id).toBe(7);
    expect(body).not.toHaveProperty('remember_sender');
  });

  test('learned records that disagree pre-select nobody', () => {
    const conflicted = [learned(PLEDGER, { confidence: 'medium', conflict: true }), learned(SENDER, { confidence: 'medium', conflict: true })];
    renderDetail({ ...baseTxn, suggested_matches: conflicted, suggested_match: conflicted[0] });
    expect(screen.queryByText('Selected Member')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Approve$/i })).toBeDisabled();
  });
});

// The Zelle Review strings were once nested under donatePage, so every
// t('zelleReview.*') fell back to a humanized key on the live screen while
// the screen's own tests (which stub t) stayed green.
describe('zelleReview strings resolve through the real provider', () => {
  const Probe = () => {
    const { t } = useLanguage();
    return <p>{t('zelleReview.createTransaction')} | {t('zelleReview.senderLink.title')}</p>;
  };

  test('English', () => {
    render(<I18nProvider><LanguageProvider><Probe /></LanguageProvider></I18nProvider>);
    expect(screen.getByText('Create transaction | Who is the sender?')).toBeInTheDocument();
  });
});
