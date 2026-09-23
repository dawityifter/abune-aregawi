import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardAttention, formatFigure } from '../../../utils/pledgeDashboardApi';

interface AttentionPanelProps {
  attention: DashboardAttention;
  /** The filter the donor table is on, so its row can be marked. */
  activeFilter?: string | null;
  onSelect: (filter: string) => void;
}

const ROWS: Array<keyof Omit<DashboardAttention, 'ending_soon'>> =
  ['stalled', 'never_started', 'overpaid', 'unlinked'];

/**
 * Counts only, each one a way into the filtered table below. The names behind
 * them live in that table, not here.
 *
 * A zero row is dropped — it is not a problem. A WITHHELD row is kept, because
 * "we are not showing you this" is different from "there is nothing here", and
 * dropping it would let a protected figure read as a clean bill of health.
 */
const AttentionPanel: React.FC<AttentionPanelProps> = ({ attention, activeFilter = null, onSelect }) => {
  const { t } = useLanguage();

  const visible = ROWS.filter((key) => attention[key] === null || (attention[key] as number) > 0);
  const nothingToShow = visible.length === 0 && !attention.ending_soon;

  if (nothingToShow) {
    return (
      <p data-testid="attention-clear" className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.attention.clear')}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {visible.map((key) => (
        <li key={key}>
          <button
            data-testid={`attention-${key.replace('_', '-')}`}
            aria-pressed={key === activeFilter}
            onClick={() => onSelect(key)}
            className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent-100 ${
              key === activeFilter ? 'bg-accent-100 ring-2 ring-accent-700 ring-inset' : ''
            }`}
          >
            <strong className="font-sans tabular-nums text-accent-700">
              {formatFigure(attention[key], 'count')}
            </strong>
            <span className="font-sans text-caption text-accent-500">
              {t(`pledgeDashboard.attention.${key}`)}
            </span>
          </button>
        </li>
      ))}
      {attention.ending_soon && (
        <li data-testid="attention-ending-soon"
          className="px-2 py-1.5 font-sans text-caption text-accent-600">
          {t('pledgeDashboard.attention.endingSoon')}
        </li>
      )}
    </ul>
  );
};

export default AttentionPanel;
