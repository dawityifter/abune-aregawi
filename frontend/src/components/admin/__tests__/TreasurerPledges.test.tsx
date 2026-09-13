import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import TreasurerPledges from '../TreasurerPledges';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

const mockFetchDonors = jest.fn();
jest.mock('../../../utils/pledgeCampaignApi', () => ({
  fetchCampaignDonors: (id: number) => mockFetchDonors(id)
}));

const mockFetchBalance = jest.fn();
jest.mock('../../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: (memberId?: number) => mockFetchBalance(memberId)
}));

const mockCreate = jest.fn();
const mockCancel = jest.fn();
const mockUpdateAmount = jest.fn();
jest.mock('../../../utils/pledgeAdminApi', () => ({
  createPledgeForMember: (input: any) => mockCreate(input),
  cancelPledge: (id: number, notes: string) => mockCancel(id, notes),
  updatePledgeAmount: (id: number, amount: number) => mockUpdateAmount(id, amount)
}));

// The real one fetches the member directory behind Firebase auth; the contract
// this component depends on is the (id, member) pair it hands back.
jest.mock('../MemberSearch', () => ({
  __esModule: true,
  default: ({ onMemberSelect }: { onMemberSelect: (id: string, m?: any) => void }) => (
    <div>
      <button onClick={() => onMemberSelect('42', { id: 42, firstName: 'Test', lastName: 'Newpledger' })}>
        pick-new-member
      </button>
      <button onClick={() => onMemberSelect('99', { id: 99, firstName: 'Test', lastName: 'Donortwo' })}>
        pick-existing-member
      </button>
    </div>
  )
}));

// Synthetic rows only — never real member names.
const DONORS = [
  {
    id: 1, name: 'Test DonorOne', amount: 300, paid_amount: 300, remaining_amount: 0,
    status: 'fulfilled', is_historical: true, pledge_type: 'one_time',
    created_at: '2026-02-01T00:00:00Z'
  },
  {
    id: 2, name: 'Test DonorTwo', amount: 500, paid_amount: 200, remaining_amount: 300,
    status: 'partially_fulfilled', is_historical: false, pledge_type: 'one_time',
    created_at: '2026-02-02T00:00:00Z'
  }
];

const renderTab = (canRecord = true) => render(
  <I18nProvider>
    <LanguageProvider>
      <TreasurerPledges canRecord={canRecord} />
    </LanguageProvider>
  </I18nProvider>
);

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActiveCampaign.mockReturnValue({
    campaign: { id: 7, name: 'Test Drive' }, loading: false, error: null
  });
  mockFetchDonors.mockResolvedValue(DONORS);
  mockFetchBalance.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: 55 });
  mockCancel.mockResolvedValue(undefined);
  mockUpdateAmount.mockResolvedValue(undefined);
});

describe('TreasurerPledges', () => {
  it('lists the pledges in the live drive with what is still owed', async () => {
    renderTab();

    expect(await screen.findByText('Test DonorOne')).toBeInTheDocument();
    expect(screen.getByText('Test DonorTwo')).toBeInTheDocument();
    expect(mockFetchDonors).toHaveBeenCalledWith(7);
    expect(within(rowFor('Test DonorTwo')).getByText(/\$300/)).toBeInTheDocument();
  });

  it('says no drive is running rather than offering an entry form', async () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });
    renderTab();

    expect(await screen.findByText(/no pledge drive is running/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record pledge/i })).not.toBeInTheDocument();
  });

  it('hides pledge entry from a role that may only read', async () => {
    renderTab(false);

    await screen.findByText('Test DonorOne');
    expect(screen.queryByRole('button', { name: /record pledge/i })).not.toBeInTheDocument();
  });

  it('records a pledge against the member the treasurer picked', async () => {
    renderTab();
    await screen.findByText('Test DonorOne');

    await userEvent.click(screen.getByRole('button', { name: /record pledge/i }));
    await userEvent.click(screen.getByText('pick-new-member'));
    await userEvent.type(screen.getByLabelText(/pledge amount/i), '1000');
    await userEvent.click(screen.getByRole('button', { name: /^save pledge$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      member_id: 42,
      amount: 1000,
      first_name: 'Test',
      last_name: 'Newpledger',
      notes: ''
    }));
  });

  it('warns about the existing pledge instead of creating a duplicate', async () => {
    mockFetchBalance.mockResolvedValue({
      id: 2, campaign_id: 7, campaign_name: 'Test Drive',
      pledged_amount: 500, paid_amount: 200, remaining_amount: 300
    });
    renderTab();
    await screen.findByText('Test DonorOne');

    await userEvent.click(screen.getByRole('button', { name: /record pledge/i }));
    await userEvent.click(screen.getByText('pick-existing-member'));

    expect(await screen.findByText(/already has a pledge/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save pledge$/i })).toBeDisabled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('cancels a pledge with the reason the treasurer gave', async () => {
    renderTab();
    await screen.findByText('Test DonorTwo');

    await userEvent.click(within(rowFor('Test DonorTwo')).getByRole('button', { name: /cancel/i }));
    await userEvent.type(screen.getByLabelText(/reason/i), 'entered twice');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancel/i }));

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith(2, 'entered twice'));
  });

  it('corrects a mistyped pledge amount', async () => {
    renderTab();
    await screen.findByText('Test DonorTwo');

    await userEvent.click(within(rowFor('Test DonorTwo')).getByRole('button', { name: /edit/i }));
    const field = screen.getByLabelText(/new amount/i);
    await userEvent.clear(field);
    await userEvent.type(field, '800');
    await userEvent.click(screen.getByRole('button', { name: /save amount/i }));

    await waitFor(() => expect(mockUpdateAmount).toHaveBeenCalledWith(2, 800));
  });

  // Editing one of these restates what a closed drive collected, because
  // pledge_balances reads their paid_amount straight off the pledge amount.
  it('offers no amount editing on a historical pledge', async () => {
    renderTab();
    await screen.findByText('Test DonorOne');

    expect(within(rowFor('Test DonorOne')).queryByRole('button', { name: /edit/i }))
      .not.toBeInTheDocument();
  });

  it('surfaces a failure to load the drive', async () => {
    mockFetchDonors.mockRejectedValue(new Error('Failed to load donors'));
    renderTab();

    expect(await screen.findByText(/failed to load donors/i)).toBeInTheDocument();
  });
});
