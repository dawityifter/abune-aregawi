import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DistributionBars from '../DistributionBars';
import { DashboardBreakdownRow } from '../../../../utils/pledgeDashboardApi';
import { I18nProvider } from '../../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../../contexts/LanguageContext';

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

const rows: DashboardBreakdownRow[] = [
  { status: 'fulfilled', pledge_count: 97, household_count: 83,
    total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 },
  { status: 'not_started', pledge_count: 20, household_count: 17,
    total_pledged: 30000, total_collected: 0, outstanding_owed: 30000 },
  { status: 'cancelled', pledge_count: 3, household_count: 1,
    total_pledged: 2200, total_collected: 0, outstanding_owed: 0 }
];

describe('DistributionBars', () => {
  it('renders a households bar and a dollars bar over the same categories', () => {
    renderWithLanguage(<DistributionBars rows={rows} onSelectStatus={jest.fn()} />);
    expect(screen.getByTestId('dist-households')).toBeInTheDocument();
    expect(screen.getByTestId('dist-dollars')).toBeInTheDocument();
  });

  // The two bars must be proportioned independently — that difference is the
  // whole point of showing both.
  it('proportions households and dollars independently', () => {
    renderWithLanguage(<DistributionBars rows={rows} onSelectStatus={jest.fn()} />);
    const households = parseFloat(screen.getByTestId('dist-households-fulfilled').style.width);
    const dollars = parseFloat(screen.getByTestId('dist-dollars-fulfilled').style.width);
    expect(households).toBeCloseTo(83 / 100 * 100, 1);   // 83 of 100 households
    expect(dollars).toBeCloseTo(44881 / 74881 * 100, 1); // 44881 of 74881 dollars
    expect(Math.abs(households - dollars)).toBeGreaterThan(1);
  });

  it('excludes cancelled pledges from both bars but still lists them', () => {
    renderWithLanguage(<DistributionBars rows={rows} onSelectStatus={jest.fn()} />);
    expect(screen.queryByTestId('dist-households-cancelled')).not.toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });

  // Spec section 11 rule 1: a withheld bucket is unknown, not empty.
  it('renders a withheld bucket as an em dash and omits its segment', () => {
    const withheld: DashboardBreakdownRow[] = [
      { status: 'fulfilled', pledge_count: 97, household_count: 83,
        total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 },
      { status: 'not_started', pledge_count: null, household_count: null,
        total_pledged: null, total_collected: null, outstanding_owed: null }
    ];
    renderWithLanguage(<DistributionBars rows={withheld} onSelectStatus={jest.fn()} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('dist-households-not_started')).not.toBeInTheDocument();
  });

  it('calls back with the status when a segment is chosen', async () => {
    const onSelectStatus = jest.fn();
    renderWithLanguage(<DistributionBars rows={rows} onSelectStatus={onSelectStatus} />);
    await userEvent.click(screen.getByTestId('dist-households-fulfilled'));
    expect(onSelectStatus).toHaveBeenCalledWith('fulfilled');
  });

  it('renders nothing but an empty note when there are no pledges', () => {
    renderWithLanguage(<DistributionBars rows={[]} onSelectStatus={jest.fn()} />);
    expect(screen.getByTestId('dist-empty')).toBeInTheDocument();
  });
});
