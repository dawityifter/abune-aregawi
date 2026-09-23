import React from 'react';
import { render, screen } from '@testing-library/react';
import MonthlyCollections from '../MonthlyCollections';
import { MonthlySeries } from '../../../../utils/pledgeDashboardApi';
import { I18nProvider } from '../../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../../contexts/LanguageContext';

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

const series: MonthlySeries = {
  available: true, reason: null, partial_historical: false,
  months: [
    { month: '2026-09', collected: 1500, cumulative: 1500 },
    { month: '2026-11', collected: 2000, cumulative: 3500 }
  ]
};

describe('MonthlyCollections', () => {
  it('draws one column per month', () => {
    renderWithLanguage(<MonthlyCollections series={series} />);
    expect(screen.getByTestId('month-2026-09')).toBeInTheDocument();
    expect(screen.getByTestId('month-2026-11')).toBeInTheDocument();
  });

  it('scales columns against the largest month', () => {
    renderWithLanguage(<MonthlyCollections series={series} />);
    const tall = Number(screen.getByTestId('month-2026-11').getAttribute('height'));
    const short = Number(screen.getByTestId('month-2026-09').getAttribute('height'));
    expect(tall).toBeGreaterThan(short);
  });

  // 403 is the designed answer for a role that may not see donor detail, not a
  // failure. Say why the chart is missing rather than showing an error.
  it('explains the restriction instead of erroring when the series is withheld', () => {
    renderWithLanguage(<MonthlyCollections series={null} />);
    expect(screen.getByTestId('monthly-restricted')).toBeInTheDocument();
  });

  it('explains why a pre-allocation drive has no series at all', () => {
    renderWithLanguage(<MonthlyCollections series={{
      available: false, reason: 'historical_campaign', partial_historical: false, months: []
    }} />);
    expect(screen.getByTestId('monthly-unavailable')).toBeInTheDocument();
  });

  it('captions a partial series rather than presenting it as complete', () => {
    renderWithLanguage(<MonthlyCollections series={{ ...series, partial_historical: true }} />);
    expect(screen.getByTestId('monthly-partial')).toBeInTheDocument();
  });

  it('shows an empty-but-available series as no payments yet', () => {
    renderWithLanguage(<MonthlyCollections series={{
      available: true, reason: null, partial_historical: false, months: []
    }} />);
    expect(screen.getByTestId('monthly-empty')).toBeInTheDocument();
  });
});
