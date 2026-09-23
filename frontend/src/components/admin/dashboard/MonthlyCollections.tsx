import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { MonthlySeries, formatFigure } from '../../../utils/pledgeDashboardApi';

interface MonthlyCollectionsProps {
  /** null means the API returned 403 — this series is tier-3 only. */
  series: MonthlySeries | null;
}

// The tallest column's share of the plot, leaving headroom for its figure.
const PEAK_HEIGHT = 80;

const note = (testId: string, text: string) => (
  <p data-testid={testId} className="font-sans text-caption text-accent-500">{text}</p>
);

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/**
 * Every month from the first in the series to the last, inclusive. The API
 * returns only months that had allocations, so a month it skips is a known
 * $0 — not a withheld figure — and dropping it would hide exactly the stall
 * this chart exists to show.
 */
const fillMonths = (months: MonthlySeries['months']) => {
  const byMonth = new Map(months.map((m) => [m.month, m.collected]));
  const [firstYear, firstMonth] = months[0].month.split('-').map(Number);
  const [lastYear, lastMonth] = months[months.length - 1].month.split('-').map(Number);
  const filled: Array<{ month: string; collected: number; date: Date }> = [];
  for (let y = firstYear, m = firstMonth; y < lastYear || (y === lastYear && m <= lastMonth);) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    filled.push({ month: key, collected: byMonth.get(key) ?? 0, date: new Date(Date.UTC(y, m - 1, 1)) });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return filled;
};

/**
 * A single series, so no legend — the heading names it. Columns are scaled
 * against the largest month rather than against the goal: this chart answers
 * "are we accelerating or stalling", not "how close are we". CSS columns
 * rather than SVG so each month can carry its figure and name as real text.
 */
const MonthlyCollections: React.FC<MonthlyCollectionsProps> = ({ series }) => {
  const { t } = useLanguage();

  if (series === null) return note('monthly-restricted', t('pledgeDashboard.monthly.restricted'));
  if (!series.available) return note('monthly-unavailable', t('pledgeDashboard.monthly.unavailable'));
  if (series.months.length === 0) return note('monthly-empty', t('pledgeDashboard.monthly.empty'));

  const months = fillMonths(series.months);
  const peak = Math.max(...months.map((m) => m.collected), 1);

  return (
    <div>
      <ol aria-label={t('pledgeDashboard.monthly.title')}
        className="flex h-40 items-end gap-2 border-b border-accent-300">
        {months.map((month) => (
          <li key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span data-testid={`month-${month.month}-value`}
              className="mb-1 font-sans text-caption tabular-nums text-accent-600">
              {formatFigure(month.collected, 'money')}
            </span>
            <div
              data-testid={`month-${month.month}`}
              style={{ height: `${(month.collected / peak) * PEAK_HEIGHT}%` }}
              className="w-3/5 rounded-t-sm bg-tsaeda-500"
            />
            {/* A zero month still gets a visible mark on the baseline: an
                empty slot reads as "missing", a stub reads as "nothing came". */}
            {month.collected === 0 && (
              <div data-testid={`month-${month.month}-zero`} className="h-px w-3/5 bg-accent-500" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-1 flex gap-2 font-sans text-caption text-accent-500">
        {months.map((month) => (
          <span key={month.month} className="min-w-0 flex-1 text-center">
            {monthShort.format(month.date)}
          </span>
        ))}
      </div>

      {series.partial_historical &&
        note('monthly-partial', t('pledgeDashboard.monthly.partial'))}
    </div>
  );
};

export default MonthlyCollections;
