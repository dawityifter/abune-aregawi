import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useLanguage } from '../contexts/LanguageContext';
import { SERVICE_SCHEDULE, formatRange, type ServiceItem } from '../data/serviceSchedule';

/**
 * The whole week, behind a disclosure.
 *
 * This content used to be open on the home page by default — the longest block
 * a first-time visitor met, above anything about the parish itself. A member
 * who wants the full week can still get it in one tap; nobody has to scroll
 * past it to reach the rest of the page.
 *
 * <details> rather than a useState toggle: it is keyboard- and screen-reader-
 * correct for free, and it still works if the JS bundle is slow to hydrate.
 */

const Row: React.FC<{ item: ServiceItem; nested?: boolean }> = ({ item, nested }) => {
  const { t } = useI18n();
  return (
    <li className={nested ? 'text-sm text-accent-500' : ''}>
      <span className="font-semibold text-accent-700">{t(`schedule.items.${item.key}`)}</span>
      <span className="text-accent-500">: {formatRange(item)}</span>
      {item.children && (
        <ul className="mt-1 ml-4 space-y-1 border-l border-accent-200 pl-3">
          {item.children.map((child) => (
            <Row key={child.key} item={child} nested />
          ))}
        </ul>
      )}
    </li>
  );
};

const FullSchedule: React.FC = () => {
  const { t } = useI18n();
  const { t: tLegacy } = useLanguage();

  return (
    <section className="max-w-7xl mx-auto px-4 pt-4">
      <details className="card group">
        <summary className="cursor-pointer list-none font-semibold text-tsaeda-600 marker:hidden">
          <span className="group-open:hidden">{t('schedule.fullSchedule')}</span>
          <span className="hidden group-open:inline">{t('schedule.hideSchedule')}</span>
        </summary>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {SERVICE_SCHEDULE.map((block) => (
            <div key={block.dayKey}>
              <h3 className="font-serif text-h4 text-primary-700">
                {tLegacy(block.dayKey) || block.dayKey}
              </h3>
              <ul className="mt-2 space-y-2">
                {block.items.map((item) => (
                  <Row key={item.key} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 border-t border-accent-200 pt-3 text-sm text-accent-500">
          {t('schedule.timesVary')} {t('schedule.allWelcome')}
        </p>
      </details>
    </section>
  );
};

export default FullSchedule;
