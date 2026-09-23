import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Comparison, formatFigure } from '../../../utils/pledgeDashboardApi';

interface YearOverYearProps {
  /** null means the API returned 403 — this comparison is tier-3 only. */
  comparison: Comparison | null;
}

/** Which figures are money, so the row knows how to format itself. */
const MONEY_ROWS = ['total_pledged', 'total_collected', 'outstanding_owed'];
const PERCENT_ROWS = ['fulfillment_rate'];

/**
 * A fixed row order rather than deriving rows from the capability flags: the
 * flags describe whether a *comparison* can be trusted (see `comparable`
 * above the table), not which figures exist. A key the API adds later, or
 * one this whitelist doesn't know, never renders — silently dropping an
 * unrecognised figure is safer than guessing how to label and format it.
 */
const ROW_ORDER = [
  'total_pledged', 'total_collected', 'outstanding_owed',
  'pledge_count', 'household_count', 'fulfillment_rate',
  'fully_paid', 'never_paid'
];

/**
 * A reference scoreboard, not a race.
 *
 * No deltas and no arrows: one drive is finished and the other is mid-flight,
 * so "37% behind" would be technically true and substantively false. Spec
 * section 6.
 */
const YearOverYear: React.FC<YearOverYearProps> = ({ comparison }) => {
  const { t } = useLanguage();

  if (comparison === null) {
    return (
      <p data-testid="yoy-restricted" className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.yoy.restricted')}
      </p>
    );
  }

  const { comparable, campaigns, figures, pledging_curve: curve } = comparison;

  const rowKeys = ROW_ORDER.filter((key) => key in figures);

  const kind = (key: string): 'money' | 'count' | 'percent' =>
    MONEY_ROWS.includes(key) ? 'money' : PERCENT_ROWS.includes(key) ? 'percent' : 'count';

  // Composed from this pair's own data. A fixed sentence was true of one
  // pair of drives only and would go quietly wrong on the next.
  const caveat = [
    campaigns.current.total_days != null && campaigns.prior.total_days != null
      ? t('pledgeDashboard.yoy.caveatDays', {
          current: String(campaigns.current.total_days),
          prior: String(campaigns.prior.total_days)
        })
      : null,
    comparable.goal === false ? t('pledgeDashboard.yoy.caveatNoGoal') : null,
    comparable.collections === false ? t('pledgeDashboard.yoy.caveatNoCollections') : null
  ].filter(Boolean).join(' ');

  // Spec section 6 rule 5: the running drive's figures are provisional and
  // should look it.
  const currentCell = campaigns.current.in_progress ? 'italic' : '';

  const peak = Math.max(
    ...curve.current.map((p) => p.cumulative_pledged),
    ...curve.prior.map((p) => p.cumulative_pledged),
    1
  );
  const span = Math.max(campaigns.current.total_days ?? 1, campaigns.prior.total_days ?? 1);
  const path = (points: Array<{ day: number; cumulative_pledged: number }>) =>
    points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${(p.day / span) * 100} ${100 - (p.cumulative_pledged / peak) * 100}`
    ).join(' ');

  return (
    <div className="space-y-4">
      {caveat && (
        <p data-testid="yoy-caveat" className="font-sans text-caption text-accent-500">{caveat}</p>
      )}

      <table className="w-full font-sans text-caption">
        <thead>
          <tr className="text-left text-accent-500">
            <th className="py-1 font-normal" />
            <th data-testid="yoy-header-current" className={`py-1 font-normal ${currentCell}`}>
              {campaigns.current.name}
              {campaigns.current.in_progress && ` · ${
                campaigns.current.total_days != null
                  ? t('pledgeDashboard.yoy.inProgress', {
                      day: String(campaigns.current.day),
                      total: String(campaigns.current.total_days)
                    })
                  : t('pledgeDashboard.yoy.inProgressNoTotal', {
                      day: String(campaigns.current.day)
                    })
              }`}
            </th>
            <th data-testid="yoy-header-prior" className="py-1 font-normal">
              {campaigns.prior.name}
              {` · ${
                campaigns.prior.total_days != null
                  ? t('pledgeDashboard.yoy.final', { days: String(campaigns.prior.total_days) })
                  : t('pledgeDashboard.yoy.finalNoDays')
              }`}
            </th>
          </tr>
        </thead>
        <tbody className="text-accent-700">
          {rowKeys.map((key) => (
            <tr key={key} data-testid={`yoy-row-${key}`} className="border-t border-accent-200">
              <td className="py-1.5 text-accent-500">{t(`pledgeDashboard.yoy.rows.${key}`)}</td>
              <td className={`py-1.5 tabular-nums ${currentCell}`}>
                {formatFigure(figures[key].current, kind(key))}
              </td>
              <td className="py-1.5 tabular-nums">{formatFigure(figures[key].prior, kind(key))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {comparable.pledging_curve && (
        <div>
          <p className="font-sans text-caption text-accent-500">
            {t('pledgeDashboard.yoy.curveTitle')}
          </p>
          {/* The top of the plot, so the curve has a scale to read against. */}
          <p data-testid="yoy-curve-peak" className="mt-1 font-sans text-caption tabular-nums text-accent-500">
            {t('pledgeDashboard.yoy.curvePeak', { amount: formatFigure(peak, 'money') })}
          </p>
          <svg
            data-testid="yoy-curve"
            role="img"
            aria-label={t('pledgeDashboard.yoy.curveTitle')}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-32 w-full"
          >
            {/* Prior year is the reference, not an equal peer: dashed and muted
                so the eye reads the current drive first. */}
            <path d={path(curve.prior)} fill="none" strokeWidth={2}
              strokeDasharray="4 3" className="stroke-accent-400" vectorEffect="non-scaling-stroke" />
            <path d={path(curve.current)} fill="none" strokeWidth={2}
              className="stroke-tsaeda-600" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul data-testid="yoy-curve-legend"
            className="mt-1 flex flex-wrap gap-x-5 gap-y-1 font-sans text-caption text-accent-600">
            <li className="flex items-center gap-2">
              <svg width="20" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="20" y2="2" strokeWidth={2} className="stroke-tsaeda-600" />
              </svg>
              {campaigns.current.name}
            </li>
            <li className="flex items-center gap-2">
              <svg width="20" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="20" y2="2" strokeWidth={2} strokeDasharray="4 3"
                  className="stroke-accent-400" />
              </svg>
              {campaigns.prior.name}
            </li>
          </ul>
          <p className="font-sans text-caption text-accent-500">
            {t('pledgeDashboard.yoy.curveCaveat')}
          </p>
        </div>
      )}
    </div>
  );
};

export default YearOverYear;
