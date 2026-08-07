import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface UpdateToastProps {
  show: boolean;
  onRefresh: () => void;
}

/**
 * Sits above the bottom bar so it does not cover the tabs. The member chooses
 * when to take the new build; nothing reloads underneath them.
 *
 * Uses the `above-nav` spacing token (Task 4) rather than a raw `bottom-[calc(...)]`
 * arbitrary value — it already encodes "bar height + safe-area inset + a gap
 * so fixed chrome clears the bar instead of sitting flush under it."
 */
const UpdateToast: React.FC<UpdateToastProps> = ({ show, onRefresh }) => {
  const { t } = useI18n();

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden fixed inset-x-0 bottom-above-nav md:bottom-4 z-50 px-4"
    >
      <div className="mx-auto max-w-md flex items-center justify-between gap-3 rounded-lg bg-gray-900 text-white px-4 py-3 shadow-lg">
        <span className="text-sm">{t('pwa.updateAvailable')}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="shrink-0 min-h-[44px] px-3 text-sm font-semibold text-secondary-400 hover:text-secondary-300"
        >
          {t('pwa.refresh')}
        </button>
      </div>
    </div>
  );
};

export default UpdateToast;
