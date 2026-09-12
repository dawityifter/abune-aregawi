import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useLanguage } from '../contexts/LanguageContext';
import { findNextService, formatTime } from '../data/serviceSchedule';

const MAPS_URL =
  'https://maps.google.com/maps?q=1621+S+Jupiter+Rd,+Garland,+TX+75042';

/**
 * Answers the one question a member opens the site to ask.
 *
 * The home page used to answer it with a forty-line list of every class and
 * activity in the week, which is not the question. This is one service, when
 * it is, how soon it is, and how to get there; the rest moves into the
 * FullSchedule disclosure underneath.
 */
const NextService: React.FC<{ now?: Date }> = ({ now = new Date() }) => {
  const { t } = useI18n();
  const { t: tLegacy } = useLanguage();
  const next = findNextService(now);

  if (!next) return null;

  const dayName = tLegacy(next.dayKey) || next.dayKey;
  const when =
    next.daysAhead === 0
      ? t('schedule.today')
      : next.daysAhead === 1
        ? t('schedule.tomorrow')
        : t('schedule.inDays').replace('{n}', String(next.daysAhead));

  return (
    <section className="max-w-7xl mx-auto px-4 pt-8">
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-caption font-semibold uppercase tracking-wider text-accent-500">
            {t('schedule.nextService')}
          </div>
          <div className="mt-1 font-serif text-h3 text-accent-700">
            {dayName} {formatTime(next.item.start)}
          </div>
          <div className="mt-0.5 text-sm text-accent-500">
            {t(`schedule.items.${next.item.key}`)} <span aria-hidden="true">·</span> {when}
          </div>
        </div>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-small"
        >
          {t('schedule.directions')}
        </a>
      </div>
    </section>
  );
};

export default NextService;
