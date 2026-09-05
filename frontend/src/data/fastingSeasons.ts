/**
 * The major fast seasons, and what today is liturgically.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  CLERGY REVIEW REQUIRED — see docs/ORTHODOX_CALENDAR_REVIEW.md
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Season *starts* are the same dates the parish published in its 2025 calendar
 * and are already covered by the golden test. Season *ends* are not — the
 * published calendar names a start and a feast, and where the last fasting day
 * falls between them is a liturgical judgement, not arithmetic. Each end below
 * carries the reasoning that was used and is flagged for confirmation.
 *
 * Deliberately NOT modelled yet: ordinary Wednesday and Friday fasting. It is
 * kept year-round except during fast-free periods whose boundaries this code
 * has no authority to assert, so claiming "today is a fast" on a Wednesday
 * could tell a member to fast on a day the Church does not. Seasons only until
 * that is confirmed.
 */

import {
  EthMonthIndex,
  ethiopianToJdn,
  fasikaJdn,
  gregorianToJdn,
  jdnToEthiopian,
  jdnToGregorian
} from './ethiopianCalendar';

const HIDAR = 3 as EthMonthIndex;
const TAHSAS = 4 as EthMonthIndex;
const HAMLE = 11 as EthMonthIndex;
const NEHASSE = 12 as EthMonthIndex;

export interface FastSeason {
  key: string;
  title: string;
  titleTi: string;
  /** Inclusive first and last day, as Julian Day Numbers. */
  startJdn: number;
  endJdn: number;
}

/** Which day of the season today is, 1-based, and how many days remain. */
export interface FastProgress {
  season: FastSeason;
  dayOfSeason: number;
  totalDays: number;
  daysRemaining: number;
}

type Anchor =
  | { kind: 'fixed'; month: EthMonthIndex; day: number }
  | { kind: 'fasika'; offset: number };

interface SeasonRule {
  key: string;
  title: string;
  titleTi: string;
  start: Anchor;
  end: Anchor;
  /** Why the end date is what it is — the part clergy need to check. */
  endRationale: string;
}

export const FAST_SEASON_RULES: SeasonRule[] = [
  {
    key: 'tsome_nebiyat',
    title: 'Fast of the Prophets (Advent)',
    titleTi: 'ጾመ ነቢያት',
    start: { kind: 'fixed', month: HIDAR, day: 15 },
    end: { kind: 'fixed', month: TAHSAS, day: 28 },
    endRationale:
      'Ends on Gahad of Gena (Tahsas 28), which the 2025 calendar marks as a fast; Gena itself (Tahsas 29) is a feast.'
  },
  {
    key: 'nineveh',
    title: 'Fast of Nineveh',
    titleTi: 'ጾመ ነነዌ',
    start: { kind: 'fasika', offset: -69 },
    end: { kind: 'fasika', offset: -67 },
    endRationale: 'Three days, exactly as the 2025 calendar lists them.'
  },
  {
    key: 'abiy_tsom',
    title: 'Great Lent (Abiy Tsom)',
    titleTi: 'ዓቢይ ጾም',
    start: { kind: 'fasika', offset: -62 },
    end: { kind: 'fasika', offset: -1 },
    endRationale:
      'Ends the day before Fasika. NOTE: the start offset of -62 is itself still open for confirmation — see the Abiy Tsom question in the calendar review.'
  },
  {
    key: 'apostles',
    title: "Fast of the Apostles",
    titleTi: 'ጾመ ሓዋርያት',
    start: { kind: 'fasika', offset: 50 },
    end: { kind: 'fixed', month: HAMLE, day: 5 },
    endRationale:
      'The 2025 calendar types "End of Apostles\' Fast (Hamle 5)" as a fast, so Hamle 5 is treated as the last fasting day rather than the first day after.'
  },
  {
    key: 'filseta',
    title: 'Fast of the Assumption (Filseta)',
    titleTi: 'ጾመ ፍልሰታ',
    start: { kind: 'fixed', month: NEHASSE, day: 1 },
    end: { kind: 'fixed', month: NEHASSE, day: 15 },
    endRationale:
      'Ends the day before Filseta (Nehasse 16), which the 2025 calendar marks as a major feast. Some reckonings fast through the 16th itself.'
  }
];

const resolveAnchor = (a: Anchor, ethYear: number, gregorianYear: number): number =>
  a.kind === 'fixed'
    ? ethiopianToJdn(ethYear, a.month, a.day)
    : fasikaJdn(gregorianYear) + a.offset;

/**
 * Every fast season whose first day falls inside the given Gregorian year.
 *
 * A season may finish in the following year — Tsome Nebiyat starts in November
 * and ends in early January — so `endJdn` is not constrained to the year.
 * Fixed anchors are resolved against both Ethiopian years that overlap the
 * Gregorian one, the same way generateOrthodoxEvents does it, so nothing has to
 * be special-cased for straddling New Year.
 */
export function fastSeasonsStartingIn(gregorianYear: number): FastSeason[] {
  const yearStart = gregorianToJdn(gregorianYear, 1, 1);
  const yearEnd = gregorianToJdn(gregorianYear, 12, 31);
  const baseEthYear = jdnToEthiopian(yearStart).year;

  const seasons: FastSeason[] = [];

  for (const rule of FAST_SEASON_RULES) {
    const ethYears = rule.start.kind === 'fixed'
      ? [baseEthYear, baseEthYear + 1]
      : [baseEthYear]; // Fasika-relative rules do not depend on the Ethiopian year.

    for (const ey of ethYears) {
      const startJdn = resolveAnchor(rule.start, ey, gregorianYear);
      if (startJdn < yearStart || startJdn > yearEnd) continue;

      let endJdn = resolveAnchor(rule.end, ey, gregorianYear);
      // A fixed end landing before its start belongs to the next Ethiopian
      // year: Tsome Nebiyat starts in Hidar and ends in Tahsas of the year
      // after.
      if (endJdn < startJdn && rule.end.kind === 'fixed') {
        endJdn = resolveAnchor(rule.end, ey + 1, gregorianYear);
      }
      if (endJdn < startJdn) continue;

      seasons.push({
        key: rule.key,
        title: rule.title,
        titleTi: rule.titleTi,
        startJdn,
        endJdn
      });
    }
  }

  return seasons.sort((a, b) => a.startJdn - b.startJdn);
}

/** The fast season containing `jdn`, or null if the day is not in one. */
export function fastSeasonOn(jdn: number): FastProgress | null {
  // The Gregorian year comes from the day itself, not from an approximate
  // Ethiopian-to-Gregorian offset. The previous year is included because a
  // season starting in November covers days in January.
  const { year: gy } = jdnToGregorian(jdn);

  for (const candidateYear of [gy - 1, gy]) {
    for (const season of fastSeasonsStartingIn(candidateYear)) {
      if (jdn < season.startJdn || jdn > season.endJdn) continue;
      return {
        season,
        dayOfSeason: jdn - season.startJdn + 1,
        totalDays: season.endJdn - season.startJdn + 1,
        daysRemaining: season.endJdn - jdn
      };
    }
  }
  return null;
}
