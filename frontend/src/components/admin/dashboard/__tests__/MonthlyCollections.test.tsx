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
    const tall = parseFloat(screen.getByTestId('month-2026-11').style.height);
    const short = parseFloat(screen.getByTestId('month-2026-09').style.height);
    expect(tall).toBeGreaterThan(short);
  });

  // Final review I4: the API returns only months with allocations. A month
  // with none is a real, known $0 — a stall — and must be drawn, not skipped.
  it('fills a month with no payments as an honest zero column', () => {
    renderWithLanguage(<MonthlyCollections series={series} />);
    const gap = screen.getByTestId('month-2026-10');
    expect(parseFloat(gap.style.height)).toBe(0);
    expect(screen.getByTestId('month-2026-10-zero')).toBeInTheDocument();
    expect(screen.getByTestId('month-2026-10-value')).toHaveTextContent('$0');
  });

  it('shows each month\'s figure and a short month name as visible text', () => {
    renderWithLanguage(<MonthlyCollections series={series} />);
    expect(screen.getByTestId('month-2026-09-value')).toHaveTextContent('$1,500');
    expect(screen.getByTestId('month-2026-11-value')).toHaveTextContent('$2,000');
    expect(screen.getByText('Sep')).toBeInTheDocument();
    expect(screen.getByText('Oct')).toBeInTheDocument();
    expect(screen.getByText('Nov')).toBeInTheDocument();
  });

  it('fills across a year boundary', () => {
    renderWithLanguage(<MonthlyCollections series={{ ...series, months: [
      { month: '2026-11', collected: 100, cumulative: 100 },
      { month: '2027-02', collected: 200, cumulative: 300 }
    ] }} />);
    ['2026-11', '2026-12', '2027-01', '2027-02']
      .forEach((m) => expect(screen.getByTestId(`month-${m}`)).toBeInTheDocument());
  });

  it('does not set axis text in the low-contrast accent-400', () => {
    const { container } = renderWithLanguage(<MonthlyCollections series={series} />);
    expect(container.querySelector('.text-accent-400')).toBeNull();
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
