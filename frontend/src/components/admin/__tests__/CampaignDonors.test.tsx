import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
  { id: 1, name: 'Test DonorOne', amount: 300, paid_amount: 300, remaining_amount: 0, status: 'fulfilled', is_historical: true, pledge_type: 'one_time', created_at: '2026-02-01T00:00:00Z' },
  { id: 2, name: 'Test DonorTwo', amount: 500, paid_amount: 200, remaining_amount: 300, status: 'partially_fulfilled', is_historical: false, pledge_type: 'one_time', created_at: '2026-02-02T00:00:00Z' },
  { id: 3, name: 'Test DonorThree', amount: 100, paid_amount: 0, remaining_amount: 100, status: 'not_started', is_historical: false, pledge_type: 'one_time', created_at: '2026-02-03T00:00:00Z' }
];

const renderDonors = () => render(
  <I18nProvider><LanguageProvider><CampaignDonors campaignId={7} campaignName="Test Drive" onClose={() => {}} /></LanguageProvider></I18nProvider>
);

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
    expect(screen.getByText('fulfilled')).toBeInTheDocument();
    expect(screen.getByText(/partially.fulfilled/i)).toBeInTheDocument();
    expect(screen.getByText(/not.started/i)).toBeInTheDocument();
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
      { id: 4, name: 'Test ModernDonor', amount: 100, paid_amount: 100, remaining_amount: 0, status: 'fulfilled', is_historical: false, pledge_type: 'one_time', created_at: '2026-02-04T00:00:00Z' }
    ]);
    renderDonors();

    await screen.findByText('Test ModernDonor');
    expect(screen.queryByText(/legacy record/i)).not.toBeInTheDocument();
  });
});
