import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { MonthlySeries, formatFigure } from '../../../utils/pledgeDashboardApi';

interface MonthlyCollectionsProps {
  /** null means the API returned 403 — this series is tier-3 only. */
  series: MonthlySeries | null;
}

const CHART_HEIGHT = 120;

const note = (testId: string, text: string) => (
  <p data-testid={testId} className="font-sans text-caption text-accent-500">{text}</p>
);

/**
 * A single series, so no legend — the heading names it. Columns are scaled
 * against the largest month rather than against the goal: this chart answers
 * "are we accelerating or stalling", not "how close are we".
 */
const MonthlyCollections: React.FC<MonthlyCollectionsProps> = ({ series }) => {
  const { t } = useLanguage();

  if (series === null) return note('monthly-restricted', t('pledgeDashboard.monthly.restricted'));
  if (!series.available) return note('monthly-unavailable', t('pledgeDashboard.monthly.unavailable'));
  if (series.months.length === 0) return note('monthly-empty', t('pledgeDashboard.monthly.empty'));

  const peak = Math.max(...series.months.map((m) => m.collected), 1);
  const barWidth = 100 / (series.months.length * 2);

  return (
    <div>
      <svg
        role="img"
        aria-label={t('pledgeDashboard.monthly.title')}
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
      >
        {series.months.map((month, index) => {
          const height = (month.collected / peak) * (CHART_HEIGHT - 16);
          return (
            <rect
              key={month.month}
              data-testid={`month-${month.month}`}
              x={index * barWidth * 2 + barWidth / 2}
              y={CHART_HEIGHT - height}
              width={barWidth}
              height={height}
              rx={1}
              className="fill-tsaeda-500"
            >
              <title>{`${month.month} · ${formatFigure(month.collected, 'money')}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="mt-1 flex justify-between font-sans text-caption text-accent-400">
        <span>{series.months[0].month}</span>
        <span>{series.months[series.months.length - 1].month}</span>
      </div>

      {series.partial_historical &&
        note('monthly-partial', t('pledgeDashboard.monthly.partial'))}
    </div>
  );
};

export default MonthlyCollections;
