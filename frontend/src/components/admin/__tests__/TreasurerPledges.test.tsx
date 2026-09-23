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

const renderTab = (
  canRecord = true,
  filter: string | null = null,
  onClearFilter: () => void = jest.fn()
) => render(
  <I18nProvider>
    <LanguageProvider>
      <TreasurerPledges canRecord={canRecord} filter={filter} onClearFilter={onClearFilter} />
    </LanguageProvider>
  </I18nProvider>
);

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const rowForAsync = async (name: string) =>
  (await screen.findByText(name)).closest('tr') as HTMLElement;

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

  // Final review M2: the status column speaks the reader's language, not the
  // database enum.
  it('shows each row status in words rather than the raw enum', async () => {
    renderTab();
    expect(within(await rowForAsync('Test DonorOne')).getByText('Paid in full')).toBeInTheDocument();
    expect(within(rowFor('Test DonorTwo')).getByText('Part paid')).toBeInTheDocument();
    expect(screen.queryByText('partially_fulfilled')).not.toBeInTheDocument();
  });

  it('falls back to the raw status for one it does not know', async () => {
    mockFetchDonors.mockResolvedValue([{ ...DONORS[0], status: 'some_new_status' }]);
    renderTab();
    expect(await screen.findByText('some_new_status')).toBeInTheDocument();
  });

  describe('filtering from the dashboard band', () => {
    it('narrows to a chosen status and shows a count chip', async () => {
      renderTab(true, 'fulfilled');

      expect(await screen.findByText('Test DonorOne')).toBeInTheDocument();
      expect(screen.queryByText('Test DonorTwo')).not.toBeInTheDocument();
      // Final review M1: the chip says what it is counting.
      expect(screen.getByTestId('pledge-filter-chip')).toHaveTextContent('Paid in full · 1 pledges');
    });

    // Final review M10: the Tigrigna "can't filter" note is long and must wrap.
    it('lets the chip row wrap', async () => {
      renderTab(true, 'stalled');
      await screen.findByText('Test DonorOne');
      expect(screen.getByTestId('pledge-filter-chip').parentElement).toHaveClass('flex-wrap');
    });

    it('maps never_started to the not_started rows the table actually has', async () => {
      mockFetchDonors.mockResolvedValue([
        ...DONORS,
        {
          id: 3, name: 'Test DonorThree', amount: 400, paid_amount: 0, remaining_amount: 400,
          status: 'not_started', is_historical: false, pledge_type: 'one_time',
          created_at: '2026-02-03T00:00:00Z'
        }
      ]);
      renderTab(true, 'never_started');

      expect(await screen.findByText('Test DonorThree')).toBeInTheDocument();
      expect(screen.queryByText('Test DonorOne')).not.toBeInTheDocument();
      expect(screen.queryByText('Test DonorTwo')).not.toBeInTheDocument();
      expect(screen.getByTestId('pledge-filter-chip')).toHaveTextContent(/nothing received/i);
    });

    // stalled/overpaid/unlinked name donor-level groups this table cannot yet
    // evaluate per row — filtering to them would show a false "0 rows" instead
    // of admitting the table can't answer that question yet.
    it('keeps all rows for an attention group the table cannot evaluate, and says so', async () => {
      renderTab(true, 'stalled');

      expect(await screen.findByText('Test DonorOne')).toBeInTheDocument();
      expect(screen.getByText('Test DonorTwo')).toBeInTheDocument();
      expect(screen.getByTestId('pledge-filter-chip'))
        .toHaveTextContent(/part paid, nothing received in 60 days/i);
      expect(screen.getByText(/can't be picked out in the table yet/i)).toBeInTheDocument();
    });

    it('calls onClearFilter when the chip is dismissed', async () => {
      const onClearFilter = jest.fn();
      renderTab(true, 'fulfilled', onClearFilter);
      await screen.findByText('Test DonorOne');

      await userEvent.click(screen.getByRole('button', { name: /clear filter/i }));

      expect(onClearFilter).toHaveBeenCalled();
    });
  });
});
