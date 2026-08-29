import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import AddPaymentModal from '../AddPaymentModal';

// AddPaymentModal mounts these (wrapped in <Elements>) whenever paymentMethod
// is 'credit_card' or 'ach'. The real components re-run an effect keyed on a
// freshly-constructed `donationData` object and an inline `onPaymentReady`
// callback the parent recreates every render, which never stabilizes and
// spins forever under React Testing Library — the same reason DonatePage's
// tests (../../__tests__/DonatePage.test.tsx) stub them out rather than let
// them mount for real. No prior AddPaymentModal test selected a card method,
// which is why this had gone unnoticed; recorded as a concern for follow-up.
jest.mock('../../StripePayment', () => {
  return function MockStripePayment() {
    return <div data-testid="stripe-payment">Stripe Payment Form</div>;
  };
});

jest.mock('../../ACHPayment', () => {
  return function MockACHPayment() {
    return <div data-testid="ach-payment">ACH Payment Form</div>;
  };
});

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

  // With no member selected the request body simply has no first_name/last_name
  // (JSON.stringify drops undefined) and Pledge.first_name is NOT NULL, so the
  // endpoint fails on a field the treasurer was never asked for.
  it('blocks a named pledge with no member selected and says why', async () => {
    render(
      <I18nProvider>
        <LanguageProvider>
          <AddPaymentModal onClose={() => {}} onPaymentAdded={() => {}} paymentView="new" />
        </LanguageProvider>
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });
    fireEvent.click(await screen.findByLabelText(/also record this as a pledge/i));

    expect(await screen.findByText(/select a member to record this pledge/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add payment$/i })).toBeDisabled();
  });

  it('lets an anonymous pledge through without a member', async () => {
    render(
      <I18nProvider>
        <LanguageProvider>
          <AddPaymentModal onClose={() => {}} onPaymentAdded={() => {}} paymentView="new" />
        </LanguageProvider>
      </I18nProvider>
    );

    fireEvent.click(screen.getByLabelText(/anonymous \/ non-member payment/i));
    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });
    fireEvent.click(await screen.findByLabelText(/also record this as a pledge/i));

    await waitFor(() =>
      expect(screen.queryByText(/select a member to record this pledge/i)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^add payment$/i })).not.toBeDisabled();
  });

  // The pledge endpoint records an already-completed payment; it never runs a
  // card charge, so ticking the box would do nothing for a card/ACH payment.
  // A control that looks armed and silently no-ops is worse than no control,
  // so it must not be offered for those methods.
  it('hides the pledge checkbox for a card payment and explains why', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });
    await screen.findByLabelText(/also record this as a pledge/i);

    fireEvent.change(screen.getByLabelText(/payment method/i), {
      target: { value: 'credit_card' }
    });

    await waitFor(() => expect(screen.getByLabelText(/payment method/i)).toHaveValue('credit_card'));
    expect(screen.queryByLabelText(/also record this as a pledge/i)).not.toBeInTheDocument();
    expect(screen.getByText(/available for cash and check payments/i)).toBeInTheDocument();
  });

  it('does not leave the pledge checkbox silently checked after switching to a card method', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });
    fireEvent.click(await screen.findByLabelText(/also record this as a pledge/i));
    expect(screen.getByLabelText(/also record this as a pledge/i)).toBeChecked();

    // Switch to a card method (hides the checkbox) and back to cash (which
    // brings it back) — if the underlying state weren't reset while hidden,
    // it would reappear still checked.
    fireEvent.change(screen.getByLabelText(/payment method/i), {
      target: { value: 'credit_card' }
    });
    await waitFor(() => expect(screen.queryByLabelText(/also record this as a pledge/i)).not.toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/payment method/i), {
      target: { value: 'cash' }
    });

    expect(await screen.findByLabelText(/also record this as a pledge/i)).not.toBeChecked();
  });
});
