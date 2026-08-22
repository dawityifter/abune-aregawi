import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import PledgeTracker from '../PledgeTracker';

/**
 * /api/pledges/stats gates its per-donor rows behind an authenticated
 * `detail=true` — those rows carry donor names, which is member PII, and the
 * public pledge page does not ask for them. So `status_breakdown[].pledges` and
 * `recent_pledges` are simply absent from the response this component actually
 * receives, and the tracker has to render totals without them.
 *
 * The fixture below is the real shape returned by the API for an anonymous
 * caller, with the amounts changed: aggregates only, no `pledges` key.
 */

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({ user: null, currentUser: null })
}));

const statsWithoutDetail = {
  success: true,
  stats: {
    total_pledged: 5000,
    total_fulfilled: 2000,
    total_remaining: 3000,
    fulfillment_rate: '40.0',
    // Deliberately distinct amounts: the headline totals and the per-status
    // totals render the same way, so shared values make assertions ambiguous.
    status_breakdown: [
      { status: 'not_started', count: 7, total_amount: 3750 },
      { status: 'partial', count: 2, total_amount: 1250 }
    ]
  }
};

const renderTracker = () => render(
  <I18nProvider>
    <LanguageProvider>
      <PledgeTracker showRecentPledges={true} compact={false} />
    </LanguageProvider>
  </I18nProvider>
);

describe('PledgeTracker', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => statsWithoutDetail
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the totals when the response carries no per-donor detail', async () => {
    renderTracker();

    // $5,000 pledged is the headline number; if the component throws while
    // mapping the absent `pledges` array, nothing renders at all.
    expect(await screen.findByText('$5,000')).toBeInTheDocument();
    expect(screen.getByText('$2,000')).toBeInTheDocument();
  });

  it('renders each status with its count', async () => {
    renderTracker();

    await waitFor(() => {
      expect(screen.getByText('not_started')).toBeInTheDocument();
    });
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('partial')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
