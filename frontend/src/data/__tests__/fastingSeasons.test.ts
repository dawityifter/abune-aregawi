/**
 * Fast seasons are checked against the published 2025 calendar the same way the
 * event generator is: a season's first day must be the day the parish printed
 * as its start, and the day after its last day must be the feast that ends it.
 * That ties the season boundaries to something the parish actually published
 * rather than to this code's own assumptions.
 */

import { fastSeasonsStartingIn, fastSeasonOn, FAST_SEASON_RULES } from '../fastingSeasons';
import { ORTHODOX_EVENTS_2025 } from '../orthodoxEvents';
import { isoToJdn, jdnToIso } from '../ethiopianCalendar';

const published = (fragment: string) => {
  const e = [...ORTHODOX_EVENTS_2025].find((x) => x.title.includes(fragment));
  if (!e) throw new Error(`no published 2025 event matching "${fragment}"`);
  return e.date;
};

const seasonIn = (year: number, key: string) => {
  const s = fastSeasonsStartingIn(year).find((x) => x.key === key);
  if (!s) throw new Error(`no ${key} season starting in ${year}`);
  return s;
};

describe('season starts match the published 2025 calendar', () => {
  it.each([
    ['nineveh', 'Fast of Nineveh (Day 1)'],
    ['abiy_tsom', 'Start of Abiy Tsom'],
    ['apostles', "Start of Apostles' Fast"],
    ['filseta', 'Start of Filseta'],
    ['tsome_nebiyat', 'Start of Tsom-Nebiyat']
  ])('%s starts on the printed date', (key, fragment) => {
    expect(jdnToIso(seasonIn(2025, key).startJdn)).toBe(published(fragment));
  });
});

describe('season ends line up with the feast that closes them', () => {
  it('Nineveh is exactly the three printed days', () => {
    const s = seasonIn(2025, 'nineveh');
    expect(jdnToIso(s.startJdn)).toBe('2025-02-10');
    expect(jdnToIso(s.endJdn)).toBe('2025-02-12');
    expect(s.endJdn - s.startJdn + 1).toBe(3);
  });

  it('Great Lent ends the day before Fasika', () => {
    const s = seasonIn(2025, 'abiy_tsom');
    expect(jdnToIso(s.endJdn + 1)).toBe(published('Fasika'));
  });

  it('Filseta ends the day before the Assumption', () => {
    const s = seasonIn(2025, 'filseta');
    expect(jdnToIso(s.endJdn + 1)).toBe(published('Filseta (Assumption'));
  });

  it("the Apostles' Fast ends on the printed Hamle 5", () => {
    const s = seasonIn(2025, 'apostles');
    expect(jdnToIso(s.endJdn)).toBe(published("End of Apostles' Fast"));
  });

  it('Tsome Nebiyat ends on Gahad of Gena, the day before Gena', () => {
    // Starts Nov 2025, ends Jan 2026 — the straddling case.
    const s = seasonIn(2025, 'tsome_nebiyat');
    expect(jdnToIso(s.startJdn)).toBe('2025-11-24');
    expect(jdnToIso(s.endJdn)).toBe('2026-01-06');
    expect(jdnToIso(s.endJdn + 1)).toBe('2026-01-07'); // Gena
  });
});

describe('fastSeasonOn', () => {
  const on = (iso: string) => fastSeasonOn(isoToJdn(iso));

  it('reports the season, the day within it, and days remaining', () => {
    const p = on('2025-02-11'); // second day of Nineveh
    expect(p).not.toBeNull();
    expect(p!.season.key).toBe('nineveh');
    expect(p!.dayOfSeason).toBe(2);
    expect(p!.totalDays).toBe(3);
    expect(p!.daysRemaining).toBe(1);
  });

  it('includes both the first and the last day of a season', () => {
    expect(on('2025-02-10')!.dayOfSeason).toBe(1);
    expect(on('2025-02-12')!.daysRemaining).toBe(0);
  });

  it('returns null on the feast that ends a fast', () => {
    expect(on('2025-04-20')).toBeNull(); // Fasika
    expect(on('2026-01-07')).toBeNull(); // Gena
  });

  it('returns null on an ordinary day outside every season', () => {
    expect(on('2025-10-15')).toBeNull();
  });

  it('finds a season that began in the previous Gregorian year', () => {
    // The case a naive same-year lookup misses.
    const p = on('2026-01-02');
    expect(p).not.toBeNull();
    expect(p!.season.key).toBe('tsome_nebiyat');
  });

  it('never reports a day as being in two seasons at once', () => {
    // Walk five years a day at a time; overlapping seasons would mean the
    // rules contradict each other.
    for (let jdn = isoToJdn('2025-01-01'); jdn <= isoToJdn('2029-12-31'); jdn++) {
      const matches = [2024, 2025, 2026, 2027, 2028, 2029]
        .flatMap((y) => fastSeasonsStartingIn(y))
        .filter((s) => jdn >= s.startJdn && jdn <= s.endJdn);
      if (matches.length > 1) {
        throw new Error(
          `${jdnToIso(jdn)} is in ${matches.length} seasons: ${matches.map((m) => m.key).join(', ')}`
        );
      }
    }
  });
});

describe('future years stay coherent', () => {
  it('produces all five seasons every year through 2035', () => {
    for (let y = 2026; y <= 2035; y++) {
      const keys = fastSeasonsStartingIn(y).map((s) => s.key).sort();
      expect(keys).toEqual(FAST_SEASON_RULES.map((r) => r.key).sort());
    }
  });

  it('gives Great Lent the same length every year', () => {
    const lengths = new Set<number>();
    for (let y = 2026; y <= 2035; y++) {
      const s = seasonIn(y, 'abiy_tsom');
      lengths.add(s.endJdn - s.startJdn + 1);
    }
    expect(Array.from(lengths)).toEqual([62]);
  });

  it("varies the Apostles' Fast length, since it starts from Fasika and ends on a fixed date", () => {
    const lengths = new Set<number>();
    for (let y = 2026; y <= 2035; y++) {
      const s = seasonIn(y, 'apostles');
      lengths.add(s.endJdn - s.startJdn + 1);
    }
    expect(lengths.size).toBeGreaterThan(1);
    // Sanity: it should never invert or run absurdly long.
    Array.from(lengths).forEach((l) => {
      expect(l).toBeGreaterThan(0);
      expect(l).toBeLessThan(60);
    });
  });
});
