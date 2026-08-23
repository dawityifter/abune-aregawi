import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ success: true, categories: [], incomeCategories: [] })
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
});
