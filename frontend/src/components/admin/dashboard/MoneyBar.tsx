import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardMoney, DashboardTimeline, formatFigure } from '../../../utils/pledgeDashboardApi';

interface MoneyBarProps {
  money: DashboardMoney;
  timeline: DashboardTimeline;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;

/**
 * The one hero element on the page.
 *
 * Scaled to the GOAL, not to the pledged total: a bar scaled to pledged would
 * read ~85% full while the drive sits under half way to its target. Segments
 * are separated by a 2px surface gap so adjacent fills stay countable, and the
 * ordering is a progression of certainty — received, promised, neither — which
 * is why a single-hue sequential ramp carries it rather than three hues.
 *
 * The pace marker states a number and takes no view. Spec section 5.
 */
const MoneyBar: React.FC<MoneyBarProps> = ({ money, timeline }) => {
  const { t } = useLanguage();
  const hasGoal = money.goal != null && money.goal > 0;
  const scale = hasGoal ? (money.goal as number) : money.pledged;

  const collectedPct = pct(money.collected, scale);
  const outstandingPct = pct(money.outstanding_owed, scale);
  const gapPct = Math.max(0, 100 - collectedPct - outstandingPct);

  return (
    <section aria-label={t('pledgeDashboard.moneyBar.label')} className="mt-4">
      <div className="flex items-baseline justify-between text-caption text-accent-500 font-sans">
        <span>$0</span>
        {hasGoal ? (
          <span>
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

        {hasGoal && timeline.elapsed_fraction != null && (
          <div
            data-testid="moneybar-pace"
            style={{ left: `${timeline.elapsed_fraction * 100}%` }}
            className="absolute -top-1 h-12 w-px bg-accent-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-caption">
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
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-accent-200" aria-hidden="true" />
            <span className="text-accent-500">{t('pledgeDashboard.moneyBar.gap')}</span>
            <strong className="text-accent-700">{formatFigure(money.gap_to_goal, 'money')}</strong>
          </span>
        )}
      </div>

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
