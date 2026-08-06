import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import {
  ORTHODOX_EVENTS,
  getEthiopianDate,
  toGeez,
  CalendarEvent
} from '../data/orthodoxEvents';
import { fastSeasonOn } from '../data/fastingSeasons';
import { gregorianToJdn, jdnToIso } from '../data/ethiopianCalendar';

/**
 * What today is, in the church.
 *
 * This is the one thing on the site that is different every morning, which is
 * the point: the liturgical year already supplies a reason to come back that
 * nothing else here has to manufacture.
 *
 * Deliberately shows fast *seasons* only. Ordinary Wednesday and Friday fasting
 * is kept year-round except during fast-free periods this code has no authority
 * to assert, and telling a member to fast on a day the Church does not would be
 * worse than saying nothing. See data/fastingSeasons.ts.
 */

type Variant = 'dashboard' | 'home';

/** Sunday-first, matching Date.getDay(). Full forms of the abbreviations the
 *  Orthodox calendar grid already uses. */
const WEEKDAYS_TI = ['ሰንበት', 'ሰኑይ', 'ሰሉስ', 'ረቡዕ', 'ሓሙስ', 'ዓርቢ', 'ቀዳም'];

const todayJdn = (now: Date) =>
  gregorianToJdn(now.getFullYear(), now.getMonth() + 1, now.getDate());

const LiturgicalToday: React.FC<{ variant?: Variant; now?: Date }> = ({
  variant = 'dashboard',
  now
}) => {
  const { t, lang } = useI18n();
  const ti = lang === 'ti';

  const today = useMemo(() => now ?? new Date(), [now]);

  const info = useMemo(() => {
    const jdn = todayJdn(today);
    const iso = jdnToIso(jdn);
    const eth = getEthiopianDate(today);
    const fast = fastSeasonOn(jdn);
    const todaysEvent: CalendarEvent | undefined = ORTHODOX_EVENTS.find(
      (e) => e.date === iso
    );
    // The next feast worth counting down to, skipping fasts and today itself.
    const nextFeast = ORTHODOX_EVENTS.filter(
      (e) => e.date > iso && e.type !== 'fast'
    ).sort((a, b) => a.date.localeCompare(b.date))[0];
    const daysToNextFeast = nextFeast
      ? Math.round(
          (Date.parse(`${nextFeast.date}T00:00:00`) -
            Date.parse(`${iso}T00:00:00`)) /
            86400000
        )
      : null;

    return { eth, fast, todaysEvent, nextFeast, daysToNextFeast };
  }, [today]);

  const { eth, fast, todaysEvent, nextFeast, daysToNextFeast } = info;

  // Feast and fast use the same colour language as the calendar below, so the
  // band and the grid agree with each other at a glance.
  const isFeast = todaysEvent && todaysEvent.type !== 'fast';
  const accent = isFeast
    ? { chip: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500', rule: 'border-amber-200' }
    : fast
      ? { chip: 'bg-purple-100 text-purple-900', dot: 'bg-purple-500', rule: 'border-purple-200' }
      : { chip: 'bg-primary-100 text-primary-900', dot: 'bg-primary-500', rule: 'border-accent-200' };

  const eventTitle = todaysEvent ? (ti ? todaysEvent.titleTi : todaysEvent.title) : '';
  const seasonTitle = fast ? (ti ? fast.season.titleTi : fast.season.title) : '';
  // Compare without the trailing parenthetical, so "Fast of Nineveh (Day 2)"
  // is recognised as the same thing as "Fast of Nineveh".
  const eventBase = eventTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const eventDuplicatesSeason =
    !!fast && !!eventBase && (seasonTitle.includes(eventBase) || eventBase.includes(seasonTitle));

  const ethDate = ti
    ? `${eth.monthTi} ${toGeez(eth.day)} ${eth.year}`
    : `${eth.month} ${eth.day}, ${eth.year}`;
  // Intl has no Tigrigna locale, and falling back to am-ET renders Amharic —
  // ማክሰኞ for Tuesday, where Tigrigna is ሰሉስ. Close enough to look right and
  // wrong enough to be noticed by the people this is for, so the weekday is
  // named explicitly and the rest kept numeric rather than asserting month
  // names in the wrong language.
  const gregDate = ti
    ? `${WEEKDAYS_TI[today.getDay()]} · ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`
    : today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

  const commemoration = ti
    ? eth.commemoration.titleTi
    : eth.commemoration.title;

  return (
    <section
      className={`bg-white rounded-lg shadow border ${accent.rule} ${
        variant === 'home' ? 'max-w-4xl mx-auto' : ''
      } p-5 mb-6`}
      aria-labelledby="liturgical-today-heading"
    >
      <h2 id="liturgical-today-heading" className="sr-only">
        {t('liturgical.heading')}
      </h2>

      {/* Date line — both calendars, since members use both */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-accent-900">{ethDate}</span>
        <span className="text-sm text-accent-500">{gregDate}</span>
      </div>

      {/* The status itself */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isFeast && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${accent.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
            {t('liturgical.feast')}
          </span>
        )}
        {fast && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${accent.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
            {t('liturgical.fast')}
          </span>
        )}
        {!isFeast && !fast && (
          <span className="text-sm text-accent-600">{t('liturgical.ordinary')}</span>
        )}
      </div>

      {/* The named day, when it adds something the season line does not.
          On a Nineveh day the event and the season are the same words, so
          printing both just says it twice; on Gahad of Gena the event names a
          day inside a longer fast and is worth keeping. */}
      {todaysEvent && !eventDuplicatesSeason && (
        <p className="mt-2 text-base font-medium text-accent-900">
          {eventTitle}
        </p>
      )}

      {fast && (
        <div className="mt-2">
          <p className="text-base font-medium text-accent-900">
            {ti ? fast.season.titleTi : fast.season.title}
          </p>
          <p className="mt-0.5 text-sm text-accent-600">
            {t('liturgical.dayOf')
              .replace('{day}', String(fast.dayOfSeason))
              .replace('{total}', String(fast.totalDays))}
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-purple-100"
            role="progressbar"
            aria-valuenow={fast.dayOfSeason}
            aria-valuemin={1}
            aria-valuemax={fast.totalDays}
            aria-label={ti ? fast.season.titleTi : fast.season.title}
          >
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${(fast.dayOfSeason / fast.totalDays) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Monthly commemoration — there is one every day, so this line never
          leaves the band empty on an ordinary Tuesday. */}
      <p className="mt-3 border-t border-accent-100 pt-3 text-sm text-accent-700">
        <span className="text-accent-500">{t('liturgical.commemoration')}: </span>
        {commemoration}
      </p>

      {nextFeast && daysToNextFeast !== null && daysToNextFeast > 0 && (
        <p className="mt-1 text-sm text-accent-600">
          <span className="text-accent-500">{t('liturgical.nextFeast')}: </span>
          {ti ? nextFeast.titleTi : nextFeast.title}
          {' · '}
          {daysToNextFeast === 1
            ? t('liturgical.tomorrow')
            : t('liturgical.inDays').replace('{days}', String(daysToNextFeast))}
        </p>
      )}
    </section>
  );
};

export default LiturgicalToday;
