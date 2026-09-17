import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import CampaignDonors from '../CampaignDonors';

const mockFetchDonors = jest.fn();
jest.mock('../../../utils/pledgeCampaignApi', () => ({
  fetchCampaignDonors: (id: number) => mockFetchDonors(id)
}));

// Synthetic donors only — never real member names.
const DONORS = [
  { id: 1, name: 'Test DonorOne', amount: 300, paid_amount: 300, remaining_amount: 0, status: 'fulfilled', is_historical: true, pledge_type: 'one_time', payment_methods: [], created_at: '2026-02-01T00:00:00Z' },
  { id: 2, name: 'Test DonorTwo', amount: 500, paid_amount: 200, remaining_amount: 300, status: 'partially_fulfilled', is_historical: false, pledge_type: 'one_time', payment_methods: ['check', 'zelle'], created_at: '2026-02-02T00:00:00Z' },
  { id: 3, name: 'Test DonorThree', amount: 100, paid_amount: 0, remaining_amount: 100, status: 'not_started', is_historical: false, pledge_type: 'one_time', payment_methods: [], created_at: '2026-02-03T00:00:00Z' }
];

const renderDonors = () => render(
  <I18nProvider><LanguageProvider><CampaignDonors campaignId={7} campaignName="Test Drive" onClose={() => {}} /></LanguageProvider></I18nProvider>
);

const table = () => screen.getByRole('table');

/** Donor names in the order they are rendered, header row excluded. */
const donorOrder = () =>
  within(table()).getAllByRole('row').slice(1)
    .map((row) => row.querySelectorAll('td')[0].textContent);

const rowFor = (name: string) =>
  within(table()).getByText(name).closest('tr') as HTMLElement;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchDonors.mockResolvedValue(DONORS);
});

describe('CampaignDonors', () => {
  it('lists every donor with pledged, paid and remaining', async () => {
    renderDonors();

    expect(await screen.findByText('Test DonorOne')).toBeInTheDocument();
    expect(screen.getByText('Test DonorTwo')).toBeInTheDocument();
    expect(screen.getByText('Test DonorThree')).toBeInTheDocument();
    // DonorTwo: $500 pledged, $200 paid, $300 remaining.
    expect(screen.getByText(/\$200/)).toBeInTheDocument();
  });

  it('requests only the campaign it was opened for', async () => {
    renderDonors();

    await waitFor(() => expect(mockFetchDonors).toHaveBeenCalledWith(7));
  });

  it('marks who has fulfilled and who has not', async () => {
    renderDonors();

    await screen.findByText('Test DonorOne');
    expect(within(table()).getByText(/^fulfilled$/i)).toBeInTheDocument();
    expect(within(table()).getByText(/^partially fulfilled$/i)).toBeInTheDocument();
    expect(within(table()).getByText(/^not started$/i)).toBeInTheDocument();
  });

  it('explains an empty drive instead of rendering a bare table', async () => {
    mockFetchDonors.mockResolvedValue([]);
    renderDonors();

    expect(await screen.findByText(/no pledges/i)).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    mockFetchDonors.mockRejectedValue(new Error('Failed to load donors'));
    renderDonors();

    expect(await screen.findByText(/failed to load donors/i)).toBeInTheDocument();
  });
});


describe('pre-modernization drives', () => {
  it('marks rows whose figures come from the legacy record', async () => {
    renderDonors();

    // These amounts are inferred from legacy_status, not reconcilable against
    // any transaction — the UI must not present them as tracked payments.
    expect(await screen.findByText(/legacy record/i)).toBeInTheDocument();
  });

  it('does not mark rows backed by real allocations', async () => {
    mockFetchDonors.mockResolvedValue([
      { id: 4, name: 'Test ModernDonor', amount: 100, paid_amount: 100, remaining_amount: 0, status: 'fulfilled', is_historical: false, pledge_type: 'one_time', payment_methods: ['zelle'], created_at: '2026-02-04T00:00:00Z' }
    ]);
    renderDonors();

    await screen.findByText('Test ModernDonor');
    expect(screen.queryByText(/legacy record/i)).not.toBeInTheDocument();
  });
});

describe('over-fulfilled donors', () => {
  it('shows an over-payment as zero outstanding plus an over-by note', async () => {
    mockFetchDonors.mockResolvedValue([
      { id: 5, name: 'Test Generous', amount: 300, paid_amount: 500, remaining_amount: -200, status: 'fulfilled', is_historical: false, pledge_type: 'one_time', payment_methods: ['cash'], created_at: '2026-02-05T00:00:00Z' }
    ]);
    renderDonors();

    await screen.findByText('Test Generous');
    expect(screen.getByText(/over by/i)).toBeInTheDocument();
    expect(screen.queryByText(/-\$200/)).not.toBeInTheDocument();
  });
});

describe('payment method column', () => {
  it('shows how each donor actually paid', async () => {
    renderDonors();
    await screen.findByText('Test DonorTwo');

    expect(within(rowFor('Test DonorTwo')).getByText('Check, Zelle')).toBeInTheDocument();
  });

  // A pledge with nothing received has no method to report, and neither does a
  // pre-allocation drive whose figures came from legacy_status.
  it('shows a dash when nothing has been collected', async () => {
    renderDonors();
    await screen.findByText('Test DonorThree');

    expect(within(rowFor('Test DonorThree')).getByText('—')).toBeInTheDocument();
  });
});

describe('filtering', () => {
  it('narrows the table to one status', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'not_started' } });

    expect(donorOrder()).toEqual(['Test DonorThree']);
  });

  it('narrows the table to one payment method', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.change(screen.getByLabelText(/payment/i), { target: { value: 'zelle' } });

    expect(donorOrder()).toEqual(['Test DonorTwo']);
  });

  it('applies both filters together', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.change(screen.getByLabelText(/payment/i), { target: { value: 'zelle' } });
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'fulfilled' } });

    // DonorTwo paid by Zelle but is only partially fulfilled, so nothing matches.
    expect(screen.getByText(/no donors match/i)).toBeInTheDocument();
  });

  // An option nobody in this drive used would be a dead end.
  it('offers only the methods this drive was paid with', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    const options = within(screen.getByLabelText(/payment/i) as HTMLElement)
      .getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['All payments', 'Check', 'Zelle']);
  });

  it('says how many rows a filter is hiding', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'not_started' } });

    expect(screen.getByText(/showing 1 of 3/i)).toBeInTheDocument();
  });
});

describe('sorting', () => {
  it('lists donors by name by default', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    expect(donorOrder()).toEqual(['Test DonorOne', 'Test DonorThree', 'Test DonorTwo']);
  });

  it('reverses the donor order when the header is clicked again', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.click(screen.getByRole('button', { name: /donor/i }));

    expect(donorOrder()).toEqual(['Test DonorTwo', 'Test DonorThree', 'Test DonorOne']);
  });

  it('sorts by pledged amount, smallest first', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.click(screen.getByRole('button', { name: /pledged/i }));

    expect(donorOrder()).toEqual(['Test DonorThree', 'Test DonorOne', 'Test DonorTwo']);
  });

  it('sorts by pledged amount, largest first', async () => {
    renderDonors();
    await screen.findByText('Test DonorOne');

    fireEvent.click(screen.getByRole('button', { name: /pledged/i }));
    fireEvent.click(screen.getByRole('button', { name: /pledged/i }));

    expect(donorOrder()).toEqual(['Test DonorTwo', 'Test DonorOne', 'Test DonorThree']);
  });
});
