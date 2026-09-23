import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardBreakdownRow, formatFigure } from '../../../utils/pledgeDashboardApi';

interface DistributionBarsProps {
  rows: DashboardBreakdownRow[];
  /**
   * money.pledged — the drive's total over the three live statuses (the
   * backend's campaign_totals already excludes cancelled). The dollars bar
   * divides by this rather than by the visible buckets, so a withheld bucket
   * cannot inflate the ones a reader is shown.
   */
  pledgedTotal: number;
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

// Brana accent-300 / accent-50 (tailwind.config.js). A hatch rather than a
// flat fill: "withheld" must not read as a fourth status on the ramp.
const WITHHELD_HATCH = 
  'repeating-linear-gradient(45deg, #cfc4ac, #cfc4ac 4px, #fbf8f1 4px, #fbf8f1 8px)';

const sum = (rows: DashboardBreakdownRow[], pick: (r: DashboardBreakdownRow) => number | null) =>
  rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

const DistributionBars: React.FC<DistributionBarsProps> = ({ rows, pledgedTotal, onSelectStatus }) => {
  const { t } = useLanguage();

  // Cancelled is listed but never plotted: a retired pledge is not part of the
  // drive's distribution, and including it would make both bars sum to more
  // than the live campaign.
  const live = ORDER
    .map((status) => rows.find((row) => row.status === status))
    .filter((row): row is DashboardBreakdownRow => Boolean(row));
  const cancelled = rows.find((row) => row.status === 'cancelled');

  const householdTotal = sum(live, (r) => r.household_count);
  const visibleDollars = sum(live, (r) => r.total_pledged);
  const dollarsWithheld = live.some((r) => r.total_pledged === null);
  const householdsWithheld = live.some((r) => r.household_count === null);
  // The part of the pledged total nobody is shown. Only its width is drawn;
  // printing the figure would spell out what suppression protects.
  const withheldDollars = dollarsWithheld ? Math.max(pledgedTotal - visibleDollars, 0) : 0;

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
    kind: 'count' | 'money',
    withheld = 0
  ) => (
    <div data-testid={testId} className="flex h-7 w-full overflow-hidden rounded-md border border-accent-200">
      {live.map((row) => {
        const value = pick(row);
        // A withheld bucket has no honest width. Omitting the segment is
        // correct; drawing it at zero would assert that it is empty.
        if (value === null) return null;
        const width = total > 0 ? Math.min((value / total) * 100, 100) : 0;
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
      {withheld > 0 && total > 0 && (
        <div
          data-testid={`${testId}-withheld`}
          style={{ width: `${(withheld / total) * 100}%`, backgroundImage: WITHHELD_HATCH }}
          title={t('pledgeDashboard.breakdown.withheld')}
          className="h-full"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.breakdown.households')}
        </p>
        {/* Households have no drive-level total to divide by, so a withheld
            bucket would silently re-proportion the others. Show no bar. */}
        {householdsWithheld ? (
          <p data-testid="dist-households-withheld" className="font-sans text-caption text-accent-500">
            {t('pledgeDashboard.breakdown.householdsWithheld')}
          </p>
        ) : bar('dist-households', (r) => r.household_count, householdTotal, 'count')}
      </div>
      <div>
        <p className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.breakdown.dollars')}
        </p>
        {bar('dist-dollars', (r) => r.total_pledged, pledgedTotal, 'money', withheldDollars)}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-caption">
        {live.map((row) => (
          <li key={row.status} className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-sm ${FILL[row.status]}`} aria-hidden="true" />
            <span className="text-accent-500">{t(`pledgeDashboard.status.${row.status}`)}</span>
            <strong className="text-accent-700">{formatFigure(row.household_count, 'count')}</strong>
            <span className="text-accent-500">{formatFigure(row.total_pledged, 'money')}</span>
          </li>
        ))}
        {dollarsWithheld && (
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundImage: WITHHELD_HATCH }}
              aria-hidden="true" />
            <span className="text-accent-500">{t('pledgeDashboard.breakdown.withheld')}</span>
          </li>
        )}
        {cancelled && (
          <li className="flex items-center gap-2 text-accent-500">
            <span>{t('pledgeDashboard.status.cancelled')}</span>
            <span>{formatFigure(cancelled.pledge_count, 'count')}</span>
          </li>
        )}
      </ul>
    </div>
  );
};

export default DistributionBars;
