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

  it('never renders a negative or overflowing segment when collection exceeds the goal', () => {
    const over = { ...money, collected: 120000, gap_to_goal: 0 };
    renderWithLanguage(<MoneyBar money={over} timeline={timeline} />);
    expect(widthOf('moneybar-collected')).toBeLessThanOrEqual(100);
    expect(widthOf('moneybar-gap')).toBeGreaterThanOrEqual(0);
  });
});
