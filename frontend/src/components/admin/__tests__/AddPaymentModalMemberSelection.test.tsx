import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import AddPaymentModal from '../AddPaymentModal';

jest.mock('../../StripePayment', () => () => <div />);
jest.mock('../../ACHPayment', () => () => <div />);

jest.mock('../../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: async () => null
}));

// Stable identities, matching production, where firebaseUser is a state value
// that keeps its identity across renders. Returning a fresh object per call
// would re-fire every effect that depends on it and manufacture a failure that
// the real app does not have. The factory runs once, so this is created once.
jest.mock('../../../contexts/AuthContext', () => {
  const user = { uid: 'test-uid', email: 'treasurer@example.test' };
  const stable = {
    user,
    currentUser: { ...user, getIdToken: async () => 'test-token' },
    firebaseUser: { getIdToken: async () => 'test-token' }
  };
  return {
    ...jest.requireActual('../../../contexts/AuthContext'),
    useAuth: () => stable
  };
});

const OPENED_FOR = {
  id: 42, firstName: 'Opened', lastName: 'Forthis',
  phoneNumber: '+15555550142', email: 'opened.forthis@example.test'
};
const CHOSEN_INSTEAD = {
  id: 43, firstName: 'Chosen', lastName: 'Instead',
  phoneNumber: '+15555550143', email: 'chosen.instead@example.test'
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/members/all/firebase')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { members: [OPENED_FOR, CHOSEN_INSTEAD] }
        })
      };
    }
    return { ok: true, json: async () => ({ success: true, categories: [], incomeCategories: [] }) };
  }) as unknown as typeof fetch;
});

// Opened from a member's dues page, so initialMemberId pre-selects them, then
// allowed to settle: the mount-time debounced member search has fired and its
// setMembers has landed before the treasurer touches anything.
const openOnMemberAndSettle = async () => {
  render(
    <I18nProvider>
      <LanguageProvider>
        <AddPaymentModal
          onClose={() => {}}
          onPaymentAdded={() => {}}
          paymentView="new"
          initialMemberId={String(OPENED_FOR.id)}
        />
      </LanguageProvider>
    </I18nProvider>
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/^member$/i)).toHaveValue(String(OPENED_FOR.id)));
  await new Promise((resolve) => setTimeout(resolve, 700));
};

describe('AddPaymentModal member selection', () => {
  it('pre-selects the member the modal was opened for', async () => {
    await openOnMemberAndSettle();

    expect(screen.getByLabelText(/^member$/i)).toHaveValue(String(OPENED_FOR.id));
  });

  // The apply-once guard is set before the branch that fetches a member missing
  // from the loaded page, so that fallback has to keep working: opening from the
  // dues page of someone outside the first page of results is ordinary.
  it('still fetches and selects a member who is not in the loaded list', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      // The list deliberately omits OPENED_FOR, forcing the fallback.
      if (url.includes('/api/members/all/firebase')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { members: [CHOSEN_INSTEAD] } })
        };
      }
      if (url.includes(`/api/members/${OPENED_FOR.id}`)) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              member: {
                id: OPENED_FOR.id,
                first_name: OPENED_FOR.firstName,
                last_name: OPENED_FOR.lastName,
                phone_number: OPENED_FOR.phoneNumber,
                email: OPENED_FOR.email
              }
            }
          })
        };
      }
      return { ok: true, json: async () => ({ success: true, categories: [], incomeCategories: [] }) };
    });

    render(
      <I18nProvider>
        <LanguageProvider>
          <AddPaymentModal
            onClose={() => {}}
            onPaymentAdded={() => {}}
            paymentView="new"
            initialMemberId={String(OPENED_FOR.id)}
          />
        </LanguageProvider>
      </I18nProvider>
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/^member$/i)).toHaveValue(String(OPENED_FOR.id)));
  });

  // The effect that applies initialMemberId lists `members` among its
  // dependencies and re-asserts the initial member every time it runs. Typing
  // in the search box replaces that array 300ms later, so the treasurer's own
  // choice was silently overwritten with the member whose page they came from
  // — and a payment entered afterwards would be filed against the wrong person.
  it('keeps the treasurer\'s chosen member when they type in the member search', async () => {
    await openOnMemberAndSettle();

    fireEvent.change(screen.getByLabelText(/^member$/i), {
      target: { value: String(CHOSEN_INSTEAD.id) }
    });
    expect(screen.getByLabelText(/^member$/i)).toHaveValue(String(CHOSEN_INSTEAD.id));

    fireEvent.change(screen.getByLabelText(/search members/i), {
      target: { value: 'chosen' }
    });
    // Past the 300ms debounce, so setMembers has replaced the array.
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(screen.getByLabelText(/^member$/i)).toHaveValue(String(CHOSEN_INSTEAD.id));
  });
});
