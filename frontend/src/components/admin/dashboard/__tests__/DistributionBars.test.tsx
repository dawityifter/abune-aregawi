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
// money.pledged for this fixture: the live buckets only — campaign_totals
// excludes cancelled pledges (backend pledgeDashboardService / pledgeViews).
const PLEDGED = 44881 + 30000;

describe('DistributionBars', () => {
  it('renders a households bar and a dollars bar over the same categories', () => {
    renderWithLanguage(<DistributionBars rows={rows} pledgedTotal={PLEDGED} onSelectStatus={jest.fn()} />);
    expect(screen.getByTestId('dist-households')).toBeInTheDocument();
    expect(screen.getByTestId('dist-dollars')).toBeInTheDocument();
  });

  // The two bars must be proportioned independently — that difference is the
  // whole point of showing both.
  it('proportions households and dollars independently', () => {
    renderWithLanguage(<DistributionBars rows={rows} pledgedTotal={PLEDGED} onSelectStatus={jest.fn()} />);
    const households = parseFloat(screen.getByTestId('dist-households-fulfilled').style.width);
    const dollars = parseFloat(screen.getByTestId('dist-dollars-fulfilled').style.width);
    expect(households).toBeCloseTo(83 / 100 * 100, 1);   // 83 of 100 households
    expect(dollars).toBeCloseTo(44881 / 74881 * 100, 1); // 44881 of 74881 dollars
    expect(Math.abs(households - dollars)).toBeGreaterThan(1);
  });

  it('excludes cancelled pledges from both bars but still lists them', () => {
    renderWithLanguage(<DistributionBars rows={rows} pledgedTotal={PLEDGED} onSelectStatus={jest.fn()} />);
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
    renderWithLanguage(<DistributionBars rows={withheld} pledgedTotal={PLEDGED} onSelectStatus={jest.fn()} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('dist-households-not_started')).not.toBeInTheDocument();
  });

  // Final review I1: for a tier-2 reader a withheld bucket must not inflate
  // the visible ones. Dollars divide by the drive's pledged total, and the
  // part nobody is shown is drawn as its own labelled, hatched segment.
  describe('when a bucket is withheld', () => {
    const withheld: DashboardBreakdownRow[] = [
      { status: 'fulfilled', pledge_count: 97, household_count: 83,
        total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 },
      { status: 'partially_fulfilled', pledge_count: null, household_count: null,
        total_pledged: null, total_collected: null, outstanding_owed: null },
      { status: 'not_started', pledge_count: 20, household_count: 17,
        total_pledged: 30000, total_collected: 0, outstanding_owed: 30000 }
    ];
    const pledged = 44881 + 30000 + 4000; // 4000 sits in the withheld bucket

    it('divides the dollars bar by the pledged total, not the visible sum', () => {
      renderWithLanguage(
        <DistributionBars rows={withheld} pledgedTotal={pledged} onSelectStatus={jest.fn()} />);
      const fulfilled = parseFloat(screen.getByTestId('dist-dollars-fulfilled').style.width);
      expect(fulfilled).toBeCloseTo(44881 / pledged * 100, 1);
    });

    it('draws the withheld remainder as its own labelled segment', () => {
      renderWithLanguage(
        <DistributionBars rows={withheld} pledgedTotal={pledged} onSelectStatus={jest.fn()} />);
      const segment = screen.getByTestId('dist-dollars-withheld');
      expect(parseFloat(segment.style.width)).toBeCloseTo(4000 / pledged * 100, 1);
      // Not a status fill: withheld must not read as a fourth step on the
      // ramp. (The hatch itself is an inline gradient, which jsdom's CSS
      // parser drops, so it cannot be asserted here.)
      expect(segment.className).not.toMatch(/\bbg-/);
      expect(screen.getByText('Withheld to protect a small group')).toBeInTheDocument();
    });

    it('does not draw the households bar at all, and says why', () => {
      renderWithLanguage(
        <DistributionBars rows={withheld} pledgedTotal={pledged} onSelectStatus={jest.fn()} />);
      expect(screen.queryByTestId('dist-households')).not.toBeInTheDocument();
      expect(screen.getByTestId('dist-households-withheld'))
        .toHaveTextContent('Household split withheld to protect a small group');
      // The dollars bar is still drawn.
      expect(screen.getByTestId('dist-dollars')).toBeInTheDocument();
    });

    it('draws no withheld segment when nothing is withheld', () => {
      renderWithLanguage(<DistributionBars rows={rows} pledgedTotal={PLEDGED} onSelectStatus={jest.fn()} />);
      expect(screen.queryByTestId('dist-dollars-withheld')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dist-households-withheld')).not.toBeInTheDocument();
    });
  });

  // Final review I7: accent-400 on the wax surface fails contrast for text
  // that carries data.
  it('does not set legend figures in the low-contrast accent-400', () => {
    const { container } = renderWithLanguage(
      <DistributionBars rows={rows} pledgedTotal={PLEDGED} onSelectStatus={jest.fn()} />);
    expect(container.querySelector('.text-accent-400')).toBeNull();
  });

  it('calls back with the status when a segment is chosen', async () => {
    const onSelectStatus = jest.fn();
    renderWithLanguage(<DistributionBars rows={rows} pledgedTotal={PLEDGED} onSelectStatus={onSelectStatus} />);
    await userEvent.click(screen.getByTestId('dist-households-fulfilled'));
    expect(onSelectStatus).toHaveBeenCalledWith('fulfilled');
  });

  it('renders nothing but an empty note when there are no pledges', () => {
    renderWithLanguage(<DistributionBars rows={[]} pledgedTotal={0} onSelectStatus={jest.fn()} />);
    expect(screen.getByTestId('dist-empty')).toBeInTheDocument();
  });
});
