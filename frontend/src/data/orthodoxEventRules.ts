/**
 * The liturgical rule table: which feasts and fasts this parish keeps, and how
 * each one is fixed to a date.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  THIS FILE IS THE ONE CLERGY REVIEW. Everything else is arithmetic.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every rule below was derived from the parish's own 2025 calendar — the one
 * credited to ቦክረ ሊቃዉንት መምህር አፈወርቅ — not from general reference material, so
 * the generator reproduces this parish's reckoning rather than someone else's.
 * `orthodoxEvents.golden.test.ts` holds that 2025 list as a fixture and fails
 * if any change here stops reproducing it.
 *
 * RESOLVED — ABUNE AREGAWI is Ethiopian day 14 (2026-08-05, Dawit Yifter).
 * The 2025 calendar printed 23 Jan and 25 Oct, both day 15, while labelling
 * them "14"; the monthly commemoration table also places Abune Aregawi on the
 * 14th. The printed dates were off by one, so the generator deliberately does
 * *not* reproduce them. Those two deviations are declared in
 * `REVIEWED_CORRECTIONS_2025` in the golden test; everything else still matches
 * the printed calendar exactly.
 *
 * STILL OPEN — ABIY TSOM start is encoded at 62 days before Fasika, which is
 * what the 2025 calendar published (17 Feb 2025) and is exactly one week after
 * the start of Nineveh. Some reckonings put Great Lent at 55 days before
 * Fasika. Confirm which this parish keeps.
 */

import type { CalendarEvent } from './orthodoxEvents';
import {
  EthMonthIndex,
  ethiopianToJdn,
  fasikaJdn,
  jdnToIso,
  jdnToEthiopian,
  gregorianToJdn
} from './ethiopianCalendar';

/**
 * Ethiopian day of the month for both Abune Aregawi feasts (Tir and Tikemt).
 * Confirmed as 14 — see the RESOLVED note above. Changing this breaks the
 * golden test on purpose; update REVIEWED_CORRECTIONS_2025 alongside it.
 */
const ABUNE_AREGAWI_DAY = 14;

type EventType = CalendarEvent['type'];

/** A feast on a fixed Ethiopian calendar date — same month and day every year. */
interface FixedRule {
  kind: 'fixed';
  month: EthMonthIndex;
  day: number;
  title: string;
  titleTi: string;
  type: EventType;
  isMajor?: boolean;
}

/** A feast whose date is an offset in days from Fasika. */
interface MovableRule {
  kind: 'movable';
  offset: number;
  title: string;
  titleTi: string;
  type: EventType;
  isMajor?: boolean;
}

type Rule = FixedRule | MovableRule;

// Ethiopian month indices, for readability below.
const MESKEREM = 1, TIKEMT = 2, HIDAR = 3, TAHSAS = 4, TIR = 5,
      MEGABIT = 7, HAMLE = 11, NEHASSE = 12;

export const ORTHODOX_EVENT_RULES: Rule[] = [
  // ── Fixed Ethiopian dates ──────────────────────────────────────────────────
  { kind: 'fixed', month: MESKEREM, day: 1, type: 'holiday',
    title: 'New Year (Enkutatash)', titleTi: 'ርእሰ ዓውደ ዓመት (እንቁጣጣሽ)' },
  { kind: 'fixed', month: MESKEREM, day: 17, type: 'major_feast',
    title: 'Meskel (Finding of the True Cross)', titleTi: 'በዓለ መስቀል' },
  { kind: 'fixed', month: TIKEMT, day: ABUNE_AREGAWI_DAY, type: 'major_feast',
    title: 'Feast of Abune Aregawi (Tikemt 14)', titleTi: 'በዓል ኣቡነ ኣረጋዊ (ጥቅምቲ 14)' },
  { kind: 'fixed', month: HIDAR, day: 15, type: 'fast', isMajor: true,
    title: 'Start of Tsom-Nebiyat (Advent Fast)', titleTi: 'ጅማሮ ጾመ ነቢያት' },
  { kind: 'fixed', month: TAHSAS, day: 19, type: 'major_feast',
    title: 'Kulubi Gabriel', titleTi: 'ቁልቢ ገብርኤል' },
  { kind: 'fixed', month: TAHSAS, day: 28, type: 'fast', isMajor: true,
    title: 'Gahad of Gena (Christmas Eve)', titleTi: 'ጋድ ብርሃነ ልደት' },
  { kind: 'fixed', month: TAHSAS, day: 29, type: 'major_feast', isMajor: true,
    title: 'Gena (Ethiopian Christmas)', titleTi: 'ብርሃነ ልደት' },
  { kind: 'fixed', month: TIR, day: 10, type: 'fast', isMajor: true,
    title: 'Gahad of Timket (Epiphany Eve)', titleTi: 'ጋድ ብርሃነ ጥምቀት' },
  { kind: 'fixed', month: TIR, day: 11, type: 'major_feast', isMajor: true,
    title: 'Timket (Ethiopian Epiphany)', titleTi: 'ብርሃነ ጥምቀት' },
  { kind: 'fixed', month: TIR, day: 12, type: 'minor_feast',
    title: 'Kana Ze Galilee', titleTi: 'ቃና ዘገሊላ' },
  { kind: 'fixed', month: TIR, day: ABUNE_AREGAWI_DAY, type: 'major_feast',
    title: 'Feast of Abune Aregawi', titleTi: 'በዓል ኣቡነ ኣረጋዊ (ጥሪ 14)' },
  { kind: 'fixed', month: MEGABIT, day: 29, type: 'major_feast', isMajor: true,
    title: 'Annunciation', titleTi: 'በስራት' },
  { kind: 'fixed', month: HAMLE, day: 5, type: 'fast',
    title: "End of Apostles' Fast (Hamle 5)", titleTi: 'ፍጻሜ ጾመ ሓዋርያት' },
  { kind: 'fixed', month: NEHASSE, day: 1, type: 'fast', isMajor: true,
    title: 'Start of Filseta (Fast of Assumption)', titleTi: 'ጅማሮ ጾመ ፍልሰታ' },
  { kind: 'fixed', month: NEHASSE, day: 13, type: 'major_feast', isMajor: true,
    title: 'Beale Transfiguration (Debre Tabor)', titleTi: 'ደብረ ታቦር' },
  { kind: 'fixed', month: NEHASSE, day: 16, type: 'major_feast', isMajor: true,
    title: 'Filseta (Assumption of Mary)', titleTi: 'በዓለ ፍልሰታ' },

  // ── Movable, reckoned from Fasika ──────────────────────────────────────────
  { kind: 'movable', offset: -69, type: 'fast', isMajor: true,
    title: 'Fast of Nineveh (Day 1)', titleTi: 'ጾመ ነነዌ (1ይ መዓልቲ)' },
  { kind: 'movable', offset: -68, type: 'fast', isMajor: true,
    title: 'Fast of Nineveh (Day 2)', titleTi: 'ጾመ ነነዌ (2ይ መዓልቲ)' },
  { kind: 'movable', offset: -67, type: 'fast', isMajor: true,
    title: 'Fast of Nineveh (Day 3)', titleTi: 'ጾመ ነነዌ (3ይ መዓልቲ)' },
  { kind: 'movable', offset: -62, type: 'fast', isMajor: true,
    title: 'Start of Abiy Tsom (Great Lent)', titleTi: 'ጅማሮ ዓቢይ ጾም' },
  { kind: 'movable', offset: -7, type: 'major_feast', isMajor: true,
    title: 'Hosanna (Palm Sunday)', titleTi: 'ሆሳእና' },
  { kind: 'movable', offset: -2, type: 'major_feast', isMajor: true,
    title: 'Siklet (Good Friday)', titleTi: 'ስቅለት' },
  { kind: 'movable', offset: 0, type: 'major_feast', isMajor: true,
    title: 'Fasika (Ethiopian Easter)', titleTi: 'ብርሃነ ትንሳኤ' },
  { kind: 'movable', offset: 39, type: 'major_feast', isMajor: true,
    title: 'Beale Urget (Ascension)', titleTi: 'በዓለ ዕርገት' },
  // Begins the day after Pentecost; its end is fixed at Hamle 5, so the fast's
  // length varies with Fasika — which is why the two are encoded differently.
  { kind: 'movable', offset: 50, type: 'fast', isMajor: true,
    title: "Start of Apostles' Fast", titleTi: 'ጅማሮ ጾመ ሓዋርያት' },
  { kind: 'movable', offset: 49, type: 'major_feast', isMajor: true,
    title: 'Paracletos (Pentecost)', titleTi: 'ጰራቅሊጦስ' }
];

/**
 * Every event falling inside one Gregorian year, sorted by date.
 *
 * Fixed rules are resolved by asking which Ethiopian year places them in the
 * requested Gregorian year — an Ethiopian year straddles two Gregorian ones, so
 * both candidates are tried and only in-range results kept. That is what makes
 * Gena appear in January (Tahsas of the previous Ethiopian year) and Meskel in
 * September of the same one, without either being special-cased.
 */
export function generateOrthodoxEvents(gregorianYear: number): CalendarEvent[] {
  const yearStart = gregorianToJdn(gregorianYear, 1, 1);
  const yearEnd = gregorianToJdn(gregorianYear, 12, 31);
  const inYear = (jdn: number) => jdn >= yearStart && jdn <= yearEnd;

  const events: CalendarEvent[] = [];

  // The Ethiopian year running at the start of the Gregorian year, and the one
  // that begins partway through it.
  const baseEthYear = jdnToEthiopian(yearStart).year;

  for (const rule of ORTHODOX_EVENT_RULES) {
    if (rule.kind === 'movable') {
      const jdn = fasikaJdn(gregorianYear) + rule.offset;
      if (inYear(jdn)) events.push(toEvent(rule, jdn));
      continue;
    }

    for (const ethYear of [baseEthYear, baseEthYear + 1]) {
      const jdn = ethiopianToJdn(ethYear, rule.month, rule.day);
      if (inYear(jdn)) events.push(toEvent(rule, jdn));
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function toEvent(rule: Rule, jdn: number): CalendarEvent {
  const event: CalendarEvent = {
    date: jdnToIso(jdn),
    title: rule.title,
    titleTi: rule.titleTi,
    type: rule.type
  };
  if (rule.isMajor) event.isMajor = true;
  return event;
}

/** Events across an inclusive range of Gregorian years. */
export function generateOrthodoxEventsForRange(from: number, to: number): CalendarEvent[] {
  const all: CalendarEvent[] = [];
  for (let y = from; y <= to; y++) all.push(...generateOrthodoxEvents(y));
  return all;
}
