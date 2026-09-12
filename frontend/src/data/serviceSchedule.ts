/**
 * The parish's weekly schedule, as data.
 *
 * It used to be ~40 lines of hard-coded JSX inside QuickLinks.tsx. That had two
 * costs: it was the longest block a visitor met on the home page, and because
 * the strings were literals rather than t() keys it stayed in English when the
 * site was switched to Tigrigna — the one block an elder most needs to read.
 *
 * As data it can be rendered as a compact "next service" line, expanded into a
 * full schedule on demand, and translated like everything else.
 */

/** JS `Date.getDay()` — 0 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ServiceItem {
  /** Key under `schedule.items` in the dictionaries. */
  key: string;
  /** Minutes from local midnight. */
  start: number;
  /** Minutes from local midnight; omitted for items with no published end. */
  end?: number;
  /** Shown indented beneath the parent in the full schedule. */
  children?: ServiceItem[];
  /**
   * The service a member means when they ask "when is the next service?".
   * Only the Divine Liturgy is marked: morning prayers at 3:00 AM are real and
   * are listed in the full schedule, but leading with them would answer a
   * question nobody asked.
   */
  primary?: boolean;
}

export interface ScheduleBlock {
  day: Weekday;
  /** Key in the legacy flat dictionary ('friday' / 'sunday'). */
  dayKey: string;
  items: ServiceItem[];
}

const hm = (h: number, m = 0) => h * 60 + m;

export const SERVICE_SCHEDULE: ScheduleBlock[] = [
  {
    day: 5,
    dayKey: 'friday',
    items: [
      {
        key: 'abnetClass',
        start: hm(18),
        end: hm(20),
        children: [
          { key: 'kidaseClass', start: hm(18), end: hm(19) },
          { key: 'geezFidelClass', start: hm(19), end: hm(19, 45) },
          { key: 'mezmurPractice', start: hm(19, 45), end: hm(20) },
        ],
      },
      { key: 'churchCleaning', start: hm(18), end: hm(20) },
      { key: 'youthAdultMezmur', start: hm(20), end: hm(21) },
    ],
  },
  {
    day: 0,
    dayKey: 'sunday',
    items: [
      { key: 'morningPrayers', start: hm(3) },
      { key: 'divineLiturgy', start: hm(6), primary: true },
      { key: 'kidsYouthClass', start: hm(9, 30), end: hm(11, 30) },
      { key: 'sundaySchool', start: hm(11, 30), end: hm(12, 30) },
    ],
  },
];

/** The church's wall clock. A member travelling should still be told when the
 *  service starts *here*, not when it starts where they happen to be. */
export const CHURCH_TIMEZONE = 'America/Chicago';

const DAY_INDEX: Record<string, Weekday> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Reads `now` as it would be read on a clock hanging in the church. */
export function churchClock(now: Date): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHURCH_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // Intl renders midnight as "24" in some engines under hour12:false.
  const hour = Number(get('hour')) % 24;

  return {
    day: DAY_INDEX[get('weekday')] ?? 0,
    minutes: hour * 60 + Number(get('minute')),
  };
}

export interface NextService {
  item: ServiceItem;
  dayKey: string;
  /** 0 = today, 1 = tomorrow, up to 7. */
  daysAhead: number;
}

/**
 * The next Divine Liturgy, searching forward from `now` through a full week.
 * Returns the same service a week out rather than null, because the schedule
 * repeats weekly and "no next service" would never be the right answer.
 */
export function findNextService(now: Date): NextService | null {
  const { day, minutes } = churchClock(now);

  const primaries = SERVICE_SCHEDULE.flatMap((block) =>
    block.items
      .filter((item) => item.primary)
      .map((item) => ({ item, dayKey: block.dayKey, day: block.day }))
  );
  if (primaries.length === 0) return null;

  let best: NextService | null = null;

  for (const candidate of primaries) {
    let daysAhead = (candidate.day - day + 7) % 7;
    // Already started today, so the next one is next week.
    if (daysAhead === 0 && candidate.item.start <= minutes) daysAhead = 7;

    if (!best || daysAhead < best.daysAhead ||
        (daysAhead === best.daysAhead && candidate.item.start < best.item.start)) {
      best = { item: candidate.item, dayKey: candidate.dayKey, daysAhead };
    }
  }

  return best;
}

/** "6:00 AM" — the format the parish already publishes its times in. */
export function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "6:00 AM - 8:00 PM", or just the start when no end is published. */
export function formatRange(item: ServiceItem): string {
  return item.end === undefined
    ? formatTime(item.start)
    : `${formatTime(item.start)} - ${formatTime(item.end)}`;
}
