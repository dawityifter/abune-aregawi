/**
 * Ethiopian <-> Gregorian conversion, and the Alexandrian computus that fixes
 * Fasika.
 *
 * These are arithmetic, not liturgical judgment: the Ethiopian calendar is a
 * fixed 12x30 + Pagumen scheme with a leap rule, and Fasika follows the same
 * Julian-reckoned Paschal computus the Eastern churches use. Which feasts fall
 * where — and on which reckoning this parish keeps them — lives in
 * `orthodoxEventRules.ts`, deliberately separated so a correction there never
 * requires touching date maths that is already verified.
 *
 * Everything here is expressed through Julian Day Numbers, which sidesteps
 * timezone and DST entirely.
 */

/** Ethiopian month index: 1 = Meskerem ... 13 = Pagumen. */
export type EthMonthIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const ETH_MONTH_NAMES = [
  'Meskerem', 'Tikemt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehasse', 'Pagumes'
];

export const ETH_MONTH_NAMES_TI = [
  'መስከረም', 'ጥቅምቲ', 'ሕዳር', 'ታሕሳስ', 'ጥሪ', 'ለካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰነ', 'ሓምለ', 'ነሓሰ', 'ጳጉሜን'
];

/**
 * JDN of Meskerem 1, 1 EC. Anchored against a date the parish already treats as
 * correct: Meskerem 1, 2018 EC = 11 September 2025, which the shipped 2025
 * calendar lists as Enkutatash.
 */
const ETHIOPIAN_EPOCH_JDN = 1724221;

/** An Ethiopian year is a leap year — Pagumen gets a 6th day — when y mod 4 = 3. */
export const isEthiopianLeapYear = (year: number): boolean => year % 4 === 3;

export const ethiopianMonthLength = (year: number, month: EthMonthIndex): number =>
  month === 13 ? (isEthiopianLeapYear(year) ? 6 : 5) : 30;

export function ethiopianToJdn(year: number, month: EthMonthIndex, day: number): number {
  return (
    ETHIOPIAN_EPOCH_JDN +
    365 * (year - 1) +
    // Leap years are those with y mod 4 === 3, so the number of leap days
    // already elapsed before `year` is floor(year / 4) — not floor((year-1)/4),
    // which undercounts by one whenever year mod 4 === 0.
    Math.floor(year / 4) +
    30 * (month - 1) +
    (day - 1)
  );
}

export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10)
  };
}

export function jdnToEthiopian(jdn: number): { year: number; month: EthMonthIndex; day: number } {
  const daysSinceEpoch = jdn - ETHIOPIAN_EPOCH_JDN;
  // 1461 days per 4-year cycle (3 common + 1 leap).
  const cycles = Math.floor(daysSinceEpoch / 1461);
  let remainder = daysSinceEpoch - cycles * 1461;
  let year = cycles * 4 + 1;

  // Walk at most the four years in the cycle; the leap year is last, so a plain
  // division would misplace the final six days.
  while (true) {
    const yearLength = isEthiopianLeapYear(year) ? 366 : 365;
    if (remainder < yearLength) break;
    remainder -= yearLength;
    year += 1;
  }

  const month = (Math.floor(remainder / 30) + 1) as EthMonthIndex;
  const day = (remainder % 30) + 1;
  return { year, month, day };
}

/** ISO `YYYY-MM-DD`, which is how CalendarEvent.date is keyed. */
export const jdnToIso = (jdn: number): string => {
  const { year, month, day } = jdnToGregorian(jdn);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const isoToJdn = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return gregorianToJdn(y, m, d);
};

/**
 * Fasika (Ethiopian Easter) as a JDN, via Meeus's Julian-calendar computus.
 *
 * The computus yields a date in the Julian calendar, which is what the
 * Alexandrian reckoning is defined on; converting through JDN rather than
 * adding a fixed 13-day offset keeps it correct past 2100, when the Julian
 * drift changes.
 *
 * @param gregorianYear the Gregorian year the feast falls in
 */
export function fasikaJdn(gregorianYear: number): number {
  const a = gregorianYear % 4;
  const b = gregorianYear % 7;
  const c = gregorianYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;
  return julianToJdn(gregorianYear, julianMonth, julianDay);
}

/** Julian-calendar date to JDN. */
export function julianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}
