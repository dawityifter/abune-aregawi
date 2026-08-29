import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import AddPaymentModal from '../AddPaymentModal';

const mockFetchBalance = jest.fn();
jest.mock('../../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: (id?: number) => mockFetchBalance(id)
}));

jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({
    user: { uid: 'test-uid' },
    currentUser: { uid: 'test-uid', getIdToken: async () => 'test-token' },
    firebaseUser: { getIdToken: async () => 'test-token' }
  })
}));

// The modal owns member selection internally; initialMemberId is the supported
// way to pre-select one. There is no `member` prop.
const renderModal = () => render(
  <I18nProvider>
    <LanguageProvider>
      <AddPaymentModal
        onClose={() => {}}
        onPaymentAdded={() => {}}
        paymentView="new"
        initialMemberId="42"
      />
    </LanguageProvider>
  </I18nProvider>
);

// A single synthetic member the mocked member-list endpoint returns, so the
// component's real selectedMemberId sync effect (AddPaymentModal.tsx ~157-215)
// can resolve initialMemberId="42" through its own matching logic rather than
// having the test bypass it.
const SYNTHETIC_MEMBER = {
  id: 42,
  firstName: 'Testy',
  lastName: 'Fixture',
  phoneNumber: '+15555550142',
  email: 'testy.fixture@example.test'
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);

    // Members list endpoint (fetchMembers) — the primary path the sync effect
    // uses to resolve initialMemberId via `members.some(...)`.
    if (url.includes('/api/members/all/firebase')) {
      return {
        ok: true,
        json: async () => ({ success: true, data: { members: [SYNTHETIC_MEMBER] } })
      };
    }

    // Specific-member fallback endpoint, only hit if the member weren't in the
    // list above. Shaped as the raw (snake_case) API response the component's
    // fetchSpecificMember transform expects.
    if (url.includes('/api/members/42')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            member: {
              id: 42,
              first_name: 'Testy',
              last_name: 'Fixture',
              phone_number: '+15555550142',
              email: 'testy.fixture@example.test'
            }
          }
        })
      };
    }

    // Income category endpoints and anything else.
    return {
      ok: true,
      json: async () => ({ success: true, categories: [], incomeCategories: [] })
    };
  }) as unknown as typeof fetch;
  mockFetchBalance.mockResolvedValue({
    id: 1, campaign_id: 2, campaign_name: 'Live Drive',
    pledged_amount: 500, paid_amount: 200, remaining_amount: 300
  });
});

describe('AddPaymentModal pledge support', () => {
  it('offers the pledge drive payment type', async () => {
    renderModal();

    // Without this option a treasurer cannot record drive money with the
    // correct type at all, so it never reaches a pledge.
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /pledge drive/i })).toBeInTheDocument();
    });
  });

  it('shows the selected member\'s outstanding pledge', async () => {
    renderModal();

    expect(await screen.findByText(/\$300/)).toBeInTheDocument();
    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalledWith(42));
  });

  it('shows no pledge line for a member without one', async () => {
    mockFetchBalance.mockResolvedValue(null);
    renderModal();

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());
    expect(screen.queryByText(/active pledge/i)).not.toBeInTheDocument();
  });

  it('offers to record a pledge for a pledge_drive payment', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });

    expect(await screen.findByLabelText(/also record this as a pledge/i)).toBeInTheDocument();
  });

  it('does not offer it for other payment types', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'donation' }
    });

    // Give any pending state updates a chance to flush before asserting absence,
    // so this isn't just checking a render that hasn't happened yet.
    await waitFor(() => expect(screen.getByLabelText(/payment type/i)).toHaveValue('donation'));
    expect(screen.queryByLabelText(/also record this as a pledge/i)).not.toBeInTheDocument();
  });

  it('labels the donor name as a baptism name for an anonymous pledge', async () => {
    renderModal();

    fireEvent.click(screen.getByLabelText(/anonymous \/ non-member payment/i));
    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });
    fireEvent.click(await screen.findByLabelText(/also record this as a pledge/i));

    expect(screen.getByLabelText(/baptism or church name/i)).toBeInTheDocument();
  });
});
