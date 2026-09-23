import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardMoney, DashboardTimeline, formatFigure } from '../../../utils/pledgeDashboardApi';

interface MoneyBarProps {
  money: DashboardMoney;
  timeline: DashboardTimeline;
}

// Rounded so float residue (1.4e-14) never reaches a style: a CSS width in
// exponent notation is invalid and the browser drops it.
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const pct = (part: number, whole: number) =>
  whole > 0 ? round4(Math.max(0, Math.min(100, (part / whole) * 100))) : 0;

/**
 * The one hero element on the page.
 *
 * Scaled to the GOAL, not to the pledged total: a bar scaled to pledged would
 * read ~85% full while the drive sits under half way to its target. (Only an
 * over-pledged drive widens the scale past the goal — see below.) Segments
 * are separated by a 2px surface gap so adjacent fills stay countable, and the
 * ordering is a progression of certainty — received, promised, neither — which
 * is why a single-hue sequential ramp carries it rather than three hues.
 *
 * The pace marker states a number and takes no view. Spec section 5.
 */
const MoneyBar: React.FC<MoneyBarProps> = ({ money, timeline }) => {
  const { t } = useLanguage();
  const hasGoal = money.goal != null && money.goal > 0;
  const goal = hasGoal ? (money.goal as number) : 0;
  const committed = money.collected + money.outstanding_owed;

  // The scale is the goal unless the drive has out-pledged it: then it grows
  // to fit received + owed, so an over-pledged drive never has its owed
  // segment clipped off the end, and the goal becomes a tick inside the bar.
  // With no goal there is nothing to measure against but the drive itself.
  const scale = hasGoal ? Math.max(goal, committed) : Math.max(money.pledged, committed);
  const goalPct = hasGoal ? pct(goal, scale) : 100;
  const goalInside = hasGoal && scale > goal;

  // "Not yet pledged" is goal − pledged. The API's gap_to_goal is goal −
  // collected — a run-rate gap for the KPI, not this segment — so it is
  // computed here. `pledged` is never suppressed.
  const notYetPledged = hasGoal ? Math.max(goal - money.pledged, 0) : 0;

  const collectedPct = pct(money.collected, scale);
  const outstandingPct = pct(money.outstanding_owed, scale);
  // Clamped to what is left so the three segments can never pass 100%
  // (over-payments put received + owed slightly above pledged).
  const gapPct = round4(Math.max(0,
    Math.min(pct(notYetPledged, scale), 100 - collectedPct - outstandingPct)));

  return (
    <section aria-label={t('pledgeDashboard.moneyBar.label')} className="mt-4">
      {/* The axis spans 0 → goal. When the goal sits inside the bar the axis
          stops at its tick, so the goal label names the tick and not the end. */}
      <div
        className="flex items-baseline justify-between gap-2 text-caption text-accent-500 font-sans"
        style={{ width: `${goalPct}%` }}
      >
        <span>$0</span>
        {hasGoal ? (
          <span className="text-right">
            {t('pledgeDashboard.moneyBar.goal')} {formatFigure(money.goal, 'money')}
          </span>
        ) : (
          <span data-testid="moneybar-nogoal">{t('pledgeDashboard.moneyBar.noGoal')}</span>
        )}
      </div>

      <div className="relative mt-1">
        <div className="flex h-10 w-full overflow-hidden rounded-md border border-accent-200 bg-accent-100">
          <div
            data-testid="moneybar-collected"
            style={{ width: `${collectedPct}%` }}
            className="h-full bg-tsaeda-600"
            title={`${t('pledgeDashboard.moneyBar.received')} ${formatFigure(money.collected, 'money')}`}
          />
          {/* 2px surface gap keeps adjacent fills countable rather than reading
              as one long block. */}
          <div style={{ width: outstandingPct > 0 ? '2px' : 0 }} className="h-full bg-accent-50" />
          <div
            data-testid="moneybar-outstanding"
            style={{ width: `${outstandingPct}%` }}
            className="h-full bg-tsaeda-300"
            title={`${t('pledgeDashboard.moneyBar.owed')} ${formatFigure(money.outstanding_owed, 'money')}`}
          />
          <div
            data-testid="moneybar-gap"
            style={{ width: `${gapPct}%` }}
            className="h-full bg-accent-200"
          />
        </div>

        {goalInside && (
          <div
            data-testid="moneybar-goal-tick"
            style={{ left: `${goalPct}%` }}
            className="absolute top-0 h-10 w-px bg-accent-600"
            aria-hidden="true"
          />
        )}

        {/* Measured against the same scale as the segments: pace is a share
            of the goal, and the goal may sit short of the bar's end. */}
        {hasGoal && timeline.elapsed_fraction != null && (
          <div
            data-testid="moneybar-pace"
            style={{ left: `${pct(timeline.elapsed_fraction * goal, scale)}%` }}
            className="absolute -top-1 h-12 w-px bg-accent-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-caption">
        <span data-testid="moneybar-legend-pledged" className="flex items-center gap-2">
          <span className="text-accent-500">{t('pledgeDashboard.moneyBar.pledged')}</span>
          <strong className="text-accent-700">{formatFigure(money.pledged, 'money')}</strong>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-tsaeda-600" aria-hidden="true" />
          <span className="text-accent-500">{t('pledgeDashboard.moneyBar.received')}</span>
          <strong className="text-accent-700">{formatFigure(money.collected, 'money')}</strong>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-tsaeda-300" aria-hidden="true" />
          <span className="text-accent-500">{t('pledgeDashboard.moneyBar.owed')}</span>
          <strong className="text-accent-700">{formatFigure(money.outstanding_owed, 'money')}</strong>
        </span>
        {hasGoal && (
          <span data-testid="moneybar-legend-gap" className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-accent-200" aria-hidden="true" />
            <span className="text-accent-500">{t('pledgeDashboard.moneyBar.gap')}</span>
            <strong className="text-accent-700">{formatFigure(notYetPledged, 'money')}</strong>
          </span>
        )}
      </div>

      {/* Spec section 11 rule 2: "Received" is defined where it is shown. */}
      <p className="mt-1 font-sans text-caption text-accent-500">
        {t('pledgeDashboard.kpi.receivedDefinition')}
      </p>

      {hasGoal && money.linear_pace_target != null && (
        <p className="mt-1 font-sans text-caption text-accent-500">
          {t('pledgeDashboard.moneyBar.paceNote', {
            day: String(timeline.day),
            amount: formatFigure(money.linear_pace_target, 'money')
          })}
        </p>
      )}
    </section>
  );
};

export default MoneyBar;
