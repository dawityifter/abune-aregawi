/**
 * The generator's correctness check.
 *
 * ORTHODOX_EVENTS_2025 is the calendar the parish actually published, credited
 * to ቦክረ ሊቃዉንት መምህር አፈወርቅ. It is treated here as a golden fixture: if the
 * generator cannot reproduce it, the generator is wrong, and no amount of
 * confidence in the arithmetic substitutes for that.
 */

import {
  ORTHODOX_EVENTS_2025,
  ETH_MONTHS_METADATA_2025_FIXTURE,
  buildEthMonthsMetadata
} from '../orthodoxEvents';
import { generateOrthodoxEvents } from '../orthodoxEventRules';
import {
  ethiopianToJdn,
  jdnToEthiopian,
  gregorianToJdn,
  jdnToGregorian,
  jdnToIso,
  fasikaJdn,
  isEthiopianLeapYear
} from '../ethiopianCalendar';

describe('Ethiopian <-> Gregorian conversion', () => {
  // Anchors taken from ETH_MONTHS_METADATA, which the shipped calendar has been
  // rendering correctly.
  const anchors: Array<[number, number, number, string]> = [
    [2017, 5, 1, '2025-01-09'],   // Tir 1, 2017
    [2018, 1, 1, '2025-09-11'],   // Meskerem 1, 2018 — Enkutatash
    [2018, 4, 1, '2025-12-10'],   // Tahsas 1, 2018
    [2018, 5, 1, '2026-01-09'],   // Tir 1, 2018
    [2019, 1, 1, '2026-09-11'],   // Meskerem 1, 2019
    [2019, 5, 1, '2027-01-09'],   // Tir 1, 2019
  ];

  it.each(anchors)('Ethiopian %i-%i-%i is %s', (ey, em, ed, iso) => {
    expect(jdnToIso(ethiopianToJdn(ey, em as any, ed))).toBe(iso);
  });

  it('round-trips every day across a four-year cycle, leap year included', () => {
    let jdn = gregorianToJdn(2024, 1, 1);
    const end = gregorianToJdn(2028, 12, 31);
    for (; jdn <= end; jdn++) {
      const e = jdnToEthiopian(jdn);
      expect(ethiopianToJdn(e.year, e.month, e.day)).toBe(jdn);
    }
  });

  it('gives Pagumen six days only in Ethiopian leap years', () => {
    expect(isEthiopianLeapYear(2019)).toBe(true);   // 2019 mod 4 === 3
    expect(isEthiopianLeapYear(2018)).toBe(false);
    // Pagumen 6 exists in 2019 and rolls into Meskerem 1 the next day.
    expect(jdnToEthiopian(ethiopianToJdn(2019, 13, 6))).toEqual({
      year: 2019, month: 13, day: 6
    });
    expect(jdnToEthiopian(ethiopianToJdn(2019, 13, 6) + 1)).toEqual({
      year: 2020, month: 1, day: 1
    });
  });

  it('round-trips Gregorian dates through JDN', () => {
    const { year, month, day } = jdnToGregorian(gregorianToJdn(2026, 2, 29 - 1));
    expect([year, month, day]).toEqual([2026, 2, 28]);
  });
});

describe('Fasika computus', () => {
  // Independently known Orthodox Pascha dates.
  const known: Array<[number, string]> = [
    [2024, '2024-05-05'],
    [2025, '2025-04-20'],
    [2026, '2026-04-12'],
    [2027, '2027-05-02'],
    [2028, '2028-04-16'],
  ];

  it.each(known)('Fasika %i falls on %s', (year, iso) => {
    expect(jdnToIso(fasikaJdn(year))).toBe(iso);
  });

  it('always lands on a Sunday', () => {
    for (let y = 2024; y <= 2040; y++) {
      // JDN 0 was a Monday, so Sunday is jdn % 7 === 6.
      expect(fasikaJdn(y) % 7).toBe(6);
    }
  });
});

/**
 * Corrections to the published 2025 calendar, accepted on review.
 *
 * ORTHODOX_EVENTS_2025 is left exactly as the parish published it — it is the
 * historical record, and editing it would erase the evidence that a correction
 * was ever needed. Deviations are declared here instead, so every difference
 * between the printed calendar and what the site now shows is a named decision
 * with a reason attached.
 *
 * 2026-08-05 — Abune Aregawi moved from Ethiopian day 15 to day 14. The 2025
 * calendar printed 23 Jan and 25 Oct (day 15) while labelling both "14", and
 * the monthly commemoration table also places Abune Aregawi on the 14th. The
 * published dates were off by one. Confirmed by Dawit Yifter.
 */
const REVIEWED_CORRECTIONS_2025: Record<string, string> = {
  '2025-01-23': '2025-01-22', // Feast of Abune Aregawi — Tir 15 → Tir 14
  '2025-10-25': '2025-10-24'  // Feast of Abune Aregawi — Tikemt 15 → Tikemt 14
};

describe('generator reproduces the published 2025 calendar', () => {
  const generated = generateOrthodoxEvents(2025);

  // What the parish published, with the reviewed corrections applied. Every
  // other event must still match the printed calendar exactly.
  const expected2025 = [...ORTHODOX_EVENTS_2025].map((e) => ({
    ...e,
    date: REVIEWED_CORRECTIONS_2025[e.date] ?? e.date
  }));

  it('produces exactly the same number of events', () => {
    expect(generated).toHaveLength(expected2025.length);
  });

  it('produces the same date for every published event', () => {
    const expectedDates = expected2025.map((e) => e.date).sort();
    const generatedDates = generated.map((e) => e.date).sort();
    expect(generatedDates).toEqual(expectedDates);
  });

  it('matches title and type on every event, date for date', () => {
    const byDate = (list: typeof generated) =>
      Object.fromEntries(list.map((e) => [e.date, e]));
    const expected = byDate(expected2025);
    const got = byDate(generated);

    for (const date of Object.keys(expected)) {
      expect(got[date]).toBeDefined();
      expect(got[date].title).toBe(expected[date].title);
      expect(got[date].type).toBe(expected[date].type);
      // The Tigrigna text matters as much as the English — a mismatch here
      // means half the congregation sees something the parish never wrote.
      expect(got[date].titleTi).toBe(expected[date].titleTi);
      expect(!!got[date].isMajor).toBe(!!expected[date].isMajor);
    }
  });

  it('applies the reviewed Abune Aregawi correction and nothing else', () => {
    // Guards the correction in both directions: the two feasts must land on
    // day 14, and no other date may drift from what was published.
    const dates = generated.map((e) => e.date);
    expect(dates).toContain('2025-01-22');
    expect(dates).toContain('2025-10-24');
    expect(dates).not.toContain('2025-01-23');
    expect(dates).not.toContain('2025-10-25');

    const drifted = [...ORTHODOX_EVENTS_2025]
      .map((e) => e.date)
      .filter((d) => !dates.includes(d));
    expect(drifted.sort()).toEqual(Object.keys(REVIEWED_CORRECTIONS_2025).sort());
  });
});

describe('generated month metadata matches the table it replaced', () => {
  // The old hand-written table ran Tir 2017 (9 Jan 2025) to Tir 2019
  // (9 Jan 2027). Generating that same span must reproduce it entry for entry,
  // including Pagumen's length and the Tigrigna month names.
  it('reproduces the 2025–2027 table exactly', () => {
    const generated = buildEthMonthsMetadata(2025, 2026).filter(
      (m) => m.startGC >= '2025-01-09' && m.startGC <= '2027-01-09'
    );
    const expected = ETH_MONTHS_METADATA_2025_FIXTURE.filter(
      (m) => m.startGC <= '2026-12-31'
    );
    expect(generated).toEqual(expected);
  });

  it('produces a contiguous run of months with no gaps', () => {
    const months = buildEthMonthsMetadata(2026, 2030);
    for (let i = 1; i < months.length; i++) {
      const prev = Date.parse(months[i - 1].startGC);
      const curr = Date.parse(months[i].startGC);
      expect((curr - prev) / 86400000).toBe(months[i - 1].days);
    }
  });
});

describe('generated future years', () => {
  it('places Gena on 7 January in a common year and 8 January before a leap year', () => {
    const gena = (y: number) =>
      generateOrthodoxEvents(y).find((e) => e.title.startsWith('Gena'))?.date;
    expect(gena(2026)).toBe('2026-01-07');
    expect(gena(2027)).toBe('2027-01-07');
    // Ethiopian 2019 is a leap year, so Tahsas 29 shifts a day in Jan 2028.
    expect(gena(2028)).toBe('2028-01-08');
  });

  it('keeps Timket exactly 12 days after Gena', () => {
    for (let y = 2026; y <= 2030; y++) {
      const evts = generateOrthodoxEvents(y);
      const gena = evts.find((e) => e.title.startsWith('Gena'));
      const timket = evts.find((e) => e.title.startsWith('Timket'));
      if (!gena || !timket) continue;
      const days =
        (Date.parse(timket.date) - Date.parse(gena.date)) / 86400000;
      expect(days).toBe(12);
    }
  });

  it('generates a full slate of events for every year through 2035', () => {
    for (let y = 2026; y <= 2035; y++) {
      const evts = generateOrthodoxEvents(y);
      expect(evts.length).toBeGreaterThanOrEqual(20);
      // Dates may repeat — a fixed feast can fall on a movable one — but the
      // same feast must never be emitted twice.
      const keys = evts.map((e) => `${e.date}|${e.title}`);
      expect(new Set(keys).size).toBe(keys.length);
      evts.forEach((e) => expect(e.date.startsWith(String(y))).toBe(true));
    }
  });

  it('emits both feasts when a fixed one falls on a movable one', () => {
    // Megabit 29 lands on Good Friday in 2034. Recorded here so the behaviour
    // is a decision rather than a surprise: the calendar UI currently shows
    // only the first event it finds for a date, so on 7 Apr 2034 one of these
    // will be hidden.
    const collisions = generateOrthodoxEvents(2034).filter(
      (e) => e.date === '2034-04-07'
    );
    expect(collisions.map((e) => e.title).sort()).toEqual([
      'Annunciation',
      'Siklet (Good Friday)'
    ]);
  });

  it('never emits an unsorted list', () => {
    const dates = generateOrthodoxEvents(2027).map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });
});
