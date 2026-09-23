import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardBreakdownRow, formatFigure } from '../../../utils/pledgeDashboardApi';

interface DistributionBarsProps {
  rows: DashboardBreakdownRow[];
  onSelectStatus: (status: string) => void;
}

/**
 * Ordered by completeness, and rendered with a sequential ramp rather than
 * three separate hues: the statuses are a progression, and the palette's
 * muted ramps cannot carry three categorical hues that a colour-blind reader
 * could separate. Value and texture also survive a printed board packet.
 */
const ORDER = ['fulfilled', 'partially_fulfilled', 'not_started'];
const FILL: Record<string, string> = {
  fulfilled: 'bg-tsaeda-600',
  partially_fulfilled: 'bg-tsaeda-400',
  not_started: 'bg-accent-300'
};

const sum = (rows: DashboardBreakdownRow[], pick: (r: DashboardBreakdownRow) => number | null) =>
  rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

const DistributionBars: React.FC<DistributionBarsProps> = ({ rows, onSelectStatus }) => {
  const { t } = useLanguage();

  // Cancelled is listed but never plotted: a retired pledge is not part of the
  // drive's distribution, and including it would make both bars sum to more
  // than the live campaign.
  const live = ORDER
    .map((status) => rows.find((row) => row.status === status))
    .filter((row): row is DashboardBreakdownRow => Boolean(row));
  const cancelled = rows.find((row) => row.status === 'cancelled');

  const householdTotal = sum(live, (r) => r.household_count);
  const dollarTotal = sum(live, (r) => r.total_pledged);

  if (live.length === 0) {
    return (
      <p data-testid="dist-empty" className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.breakdown.empty')}
      </p>
    );
  }

  const bar = (
    testId: string,
    pick: (r: DashboardBreakdownRow) => number | null,
    total: number,
    kind: 'count' | 'money'
  ) => (
    <div data-testid={testId} className="flex h-7 w-full overflow-hidden rounded-md border border-accent-200">
      {live.map((row) => {
        const value = pick(row);
        // A withheld bucket has no honest width. Omitting the segment is
        // correct; drawing it at zero would assert that it is empty.
        if (value === null) return null;
        const width = total > 0 ? (value / total) * 100 : 0;
        return (
          <button
            key={row.status}
            data-testid={`${testId}-${row.status}`}
            style={{ width: `${width}%` }}
            onClick={() => onSelectStatus(row.status)}
            title={`${t(`pledgeDashboard.status.${row.status}`)} ${formatFigure(value, kind)}`}
            className={`h-full border-r-2 border-accent-50 last:border-r-0 ${FILL[row.status]}`}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.breakdown.households')}
        </p>
        {bar('dist-households', (r) => r.household_count, householdTotal, 'count')}
      </div>
      <div>
        <p className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.breakdown.dollars')}
        </p>
        {bar('dist-dollars', (r) => r.total_pledged, dollarTotal, 'money')}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-caption">
        {live.map((row) => (
          <li key={row.status} className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-sm ${FILL[row.status]}`} aria-hidden="true" />
            <span className="text-accent-500">{t(`pledgeDashboard.status.${row.status}`)}</span>
            <strong className="text-accent-700">{formatFigure(row.household_count, 'count')}</strong>
            <span className="text-accent-400">{formatFigure(row.total_pledged, 'money')}</span>
          </li>
        ))}
        {cancelled && (
          <li className="flex items-center gap-2 text-accent-400">
            <span>{t('pledgeDashboard.status.cancelled')}</span>
            <span>{formatFigure(cancelled.pledge_count, 'count')}</span>
          </li>
        )}
      </ul>
    </div>
  );
};

export default DistributionBars;
