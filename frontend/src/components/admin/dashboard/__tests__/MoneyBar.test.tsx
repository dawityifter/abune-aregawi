import React from 'react';
import { render, screen } from '@testing-library/react';
import MoneyBar from '../MoneyBar';
import { DashboardMoney, DashboardTimeline } from '../../../../utils/pledgeDashboardApi';
import { I18nProvider } from '../../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../../contexts/LanguageContext';

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

const money: DashboardMoney = {
  pledged: 53881, collected: 45581, outstanding_owed: 9000, overpaid: 700,
  goal: 100000, gap_to_goal: 54419, percent_to_goal: 45.6,
  fulfillment_rate: 84.6, linear_pace_target: 18033, required_run_rate: 545
};
const timeline: DashboardTimeline = {
  day: 22, total_days: 122, days_remaining: 100, elapsed_fraction: 0.18
};

const widthOf = (testId: string) => {
  const el = screen.getByTestId(testId);
  return parseFloat(el.style.width);
};

describe('MoneyBar', () => {
  it('scales each segment to the goal, not to the pledged total', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    // 45581/100000 and 9000/100000 — a bar scaled to `pledged` would show
    // ~85% received and mislead about progress toward the goal.
    expect(widthOf('moneybar-collected')).toBeCloseTo(45.581, 1);
    expect(widthOf('moneybar-outstanding')).toBeCloseTo(9, 1);
  });

  it('labels the segments with real figures', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    expect(screen.getByText('$45,581')).toBeInTheDocument();
    expect(screen.getByText('$9,000')).toBeInTheDocument();
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
  });

  it('places the pace marker at the elapsed fraction of the goal', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    expect(parseFloat(screen.getByTestId('moneybar-pace').style.left)).toBeCloseTo(18, 0);
  });

  // Spec section 5: the marker is factual, never a verdict. The drive is
  // currently far ahead of pace; a design that only knows how to scold would
  // be wrong today in the opposite direction.
  it('states the pace figure without a pass or fail colour', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    const marker = screen.getByTestId('moneybar-pace');
    expect(marker.className).not.toMatch(/red|green|primary-700/);
  });

  it('renders without a goal, showing pledged and received only', () => {
    const noGoal = { ...money, goal: null, gap_to_goal: null,
      percent_to_goal: null, linear_pace_target: null, required_run_rate: null };
    renderWithLanguage(<MoneyBar money={noGoal} timeline={timeline} />);
    expect(screen.queryByTestId('moneybar-pace')).not.toBeInTheDocument();
    expect(screen.getByTestId('moneybar-nogoal')).toBeInTheDocument();
  });

  // Final review C1: "Not yet pledged" is goal − pledged. The API's
  // gap_to_goal is goal − collected (a run-rate gap) and must not be shown
  // under this label; the grey segment and its figure have to agree.
  it('labels "Not yet pledged" as goal minus pledged, not the run-rate gap', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    const gapLegend = screen.getByTestId('moneybar-legend-gap');
    expect(gapLegend).toHaveTextContent('Not yet pledged');
    expect(gapLegend).toHaveTextContent('$46,119');
    expect(gapLegend).not.toHaveTextContent('$54,419');
    // The segment is goal − pledged too, clamped to what received + owed
    // leave: this fixture's $700 over-payment puts received + owed $700 past
    // pledged, so the grey segment gives up that 0.7% rather than overflow.
    expect(widthOf('moneybar-gap')).toBeCloseTo(100 - 45.581 - 9, 1);
  });

  it('shows the total pledged as a figure in the legend', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    expect(screen.getByTestId('moneybar-legend-pledged')).toHaveTextContent('Pledged');
    expect(screen.getByTestId('moneybar-legend-pledged')).toHaveTextContent('$53,881');
  });

  // Spec section 11 rule 2: "Received" is defined where it is shown.
  it('defines "Received" in a visible caption under the legend', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    expect(screen.getByText('Payments allocated to pledges in this drive')).toBeInTheDocument();
  });

  // An over-pledged drive: pledged and owed together run past the goal.
  // Scaled to the goal alone, the owed segment would be clipped off the end.
  describe('when pledges exceed the goal', () => {
    const over: DashboardMoney = {
      ...money, goal: 50000, pledged: 60000, collected: 45000, outstanding_owed: 15000,
      gap_to_goal: 5000
    };

    it('rescales so received + owed + gap never pass 100% and owed is not clipped', () => {
      renderWithLanguage(<MoneyBar money={over} timeline={timeline} />);
      const total = widthOf('moneybar-collected') + widthOf('moneybar-outstanding')
        + widthOf('moneybar-gap');
      expect(total).toBeLessThanOrEqual(100.0001);
      expect(widthOf('moneybar-collected')).toBeCloseTo(75, 1);   // 45000 / 60000
      expect(widthOf('moneybar-outstanding')).toBeCloseTo(25, 1); // 15000 / 60000
      expect(widthOf('moneybar-gap')).toBe(0);
    });

    it('marks the goal with a tick inside the bar, and scales the pace marker to match', () => {
      renderWithLanguage(<MoneyBar money={over} timeline={timeline} />);
      const tick = screen.getByTestId('moneybar-goal-tick');
      expect(parseFloat(tick.style.left)).toBeCloseTo(50000 / 60000 * 100, 1);
      // elapsed 0.18 of a 50k goal, on a 60k scale.
      expect(parseFloat(screen.getByTestId('moneybar-pace').style.left))
        .toBeCloseTo(0.18 * 50000 / 60000 * 100, 1);
      expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
    });
  });

  it('draws no goal tick when the goal is the scale', () => {
    renderWithLanguage(<MoneyBar money={money} timeline={timeline} />);
    expect(screen.queryByTestId('moneybar-goal-tick')).not.toBeInTheDocument();
  });

  it('never renders a negative or overflowing segment when collection exceeds the goal', () => {
    const over = { ...money, collected: 120000, gap_to_goal: 0 };
    renderWithLanguage(<MoneyBar money={over} timeline={timeline} />);
    expect(widthOf('moneybar-collected')).toBeLessThanOrEqual(100);
    expect(widthOf('moneybar-gap')).toBeGreaterThanOrEqual(0);
  });
});
