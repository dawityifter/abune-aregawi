import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignHeader from '../CampaignHeader';
import { DashboardCampaign, DashboardTimeline } from '../../../../utils/pledgeDashboardApi';
import { I18nProvider } from '../../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../../contexts/LanguageContext';

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

const campaign: DashboardCampaign = {
  id: '2', slug: '2026-pledge-drive', name: '2026 Pledge Drive', name_ti: null,
  start_date: '2026-09-01', end_date: '2026-12-31', status: 'active', goal_amount: 100000
};
const timeline: DashboardTimeline = {
  day: 22, total_days: 122, days_remaining: 100, elapsed_fraction: 0.18
};

describe('CampaignHeader', () => {
  it('names the drive and states where it is in its window', () => {
    renderWithLanguage(<CampaignHeader campaign={campaign} timeline={timeline}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={jest.fn()} />);
    expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument();
    expect(screen.getByText(/22/)).toBeInTheDocument();
    expect(screen.getByText(/122/)).toBeInTheDocument();
  });

  it('omits the day count for an open-ended drive', () => {
    const openEnded = { ...campaign, end_date: null };
    const noTotal = { ...timeline, total_days: null, days_remaining: null, elapsed_fraction: null };
    renderWithLanguage(<CampaignHeader campaign={openEnded} timeline={noTotal}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={jest.fn()} />);
    expect(screen.queryByTestId('campaign-window')).not.toBeInTheDocument();
  });

  // Spec section 11 rule 9: numbers must not shift under a board discussion.
  it('shows an as-of time and refreshes only when asked', async () => {
    const onRefresh = jest.fn();
    renderWithLanguage(<CampaignHeader campaign={campaign} timeline={timeline}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={onRefresh} />);
    expect(screen.getByTestId('as-of')).toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // Ruling R4: the status enum must not leak into the UI untranslated.
  it('shows the translated status label for a known status', () => {
    renderWithLanguage(<CampaignHeader campaign={campaign} timeline={timeline}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={jest.fn()} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
