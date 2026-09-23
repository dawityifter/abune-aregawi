import React from 'react';
import { render, screen } from '@testing-library/react';
import YearOverYear from '../YearOverYear';
import { Comparison } from '../../../../utils/pledgeDashboardApi';
import { I18nProvider } from '../../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../../contexts/LanguageContext';

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

const comparison: Comparison = {
  comparable: { goal: false, collections: false, partial: false, pledging_curve: true },
  campaigns: {
    current: { id: '2', slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', total_days: 122, in_progress: true, day: 22 },
    prior: { id: '1', slug: '2025-pledge-drive', name: '2025', start_date: '2025-09-13',
      end_date: '2026-01-12', total_days: 122, in_progress: false, day: 122 }
  },
  figures: {
    total_pledged: { current: 53881, prior: 69949 },
    total_collected: { current: 45581, prior: 61599 },
    fully_paid: { current: 97, prior: 129 },
    // R6: not in the ROW_ORDER whitelist — must never render, regardless of
    // any capability flag. comparable.goal is false here too, but the point
    // of the whitelist is that an unlisted key never renders even if a flag
    // would otherwise seem to allow it.
    percent_to_goal: { current: 45, prior: 0 }
  },
  pledging_curve: {
    current: [{ day: 1, cumulative_pledged: 1000 }, { day: 22, cumulative_pledged: 53881 }],
    prior: [{ day: 1, cumulative_pledged: 2000 }, { day: 122, cumulative_pledged: 69949 }]
  }
};

describe('YearOverYear', () => {
  it('shows the comparable figures side by side', () => {
    renderWithLanguage(<YearOverYear comparison={comparison} />);
    expect(screen.getByText('$53,881')).toBeInTheDocument();
    expect(screen.getByText('$69,949')).toBeInTheDocument();
  });

  // Spec section 6 rule 1: the asymmetry belongs in the column headers, not in
  // a caption the bars have already contradicted.
  it('marks which drive is still running, in the headers', () => {
    renderWithLanguage(<YearOverYear comparison={comparison} />);
    expect(screen.getByTestId('yoy-header-current')).toHaveTextContent(/22/);
    expect(screen.getByTestId('yoy-header-prior')).toHaveTextContent(/122/);
  });

  // Rule 3 / R6: rows are drawn from a fixed whitelist rather than the
  // capability flags. Keys the fixture never carries can't render (goal,
  // partial are not figures at all), and a key present in `figures` but
  // absent from the whitelist (percent_to_goal) must not render either.
  it('omits rows the whitelist does not include', () => {
    renderWithLanguage(<YearOverYear comparison={comparison} />);
    expect(screen.queryByTestId('yoy-row-goal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('yoy-row-partial')).not.toBeInTheDocument();
    expect(screen.queryByTestId('yoy-row-percent_to_goal')).not.toBeInTheDocument();
  });

  // Rule 6: no deltas for this pairing. One drive is finished, the other is not.
  it('shows no percentage change or direction arrows', () => {
    const { container } = renderWithLanguage(<YearOverYear comparison={comparison} />);
    expect(container.textContent).not.toMatch(/[▲▼]|behind|ahead/i);
  });

  it('draws the pledging curve when the flag allows it', () => {
    renderWithLanguage(<YearOverYear comparison={comparison} />);
    expect(screen.getByTestId('yoy-curve')).toBeInTheDocument();
  });

  it('explains the restriction instead of erroring when withheld', () => {
    renderWithLanguage(<YearOverYear comparison={null} />);
    expect(screen.getByTestId('yoy-restricted')).toBeInTheDocument();
  });

  // Guard: total_days can be null (a drive with no end date). The header must
  // not render a dangling "of " with nothing after it.
  it('omits the "of total" suffix when total_days is null', () => {
    const noTotal: Comparison = {
      ...comparison,
      campaigns: {
        ...comparison.campaigns,
        current: { ...comparison.campaigns.current, total_days: null }
      }
    };
    renderWithLanguage(<YearOverYear comparison={noTotal} />);
    expect(screen.getByTestId('yoy-header-current')).not.toHaveTextContent(/of\s*$/);
    expect(screen.getByTestId('yoy-header-current')).not.toHaveTextContent('of null');
  });
});
