import {
  findNextService,
  churchClock,
  formatTime,
  formatRange,
  SERVICE_SCHEDULE,
} from '../serviceSchedule';

/**
 * The schedule used to be hard-coded JSX, so "when is the next service?" was a
 * question the member had to answer themselves by reading a forty-line list.
 * Now it is arithmetic, and arithmetic over weekdays and timezones is exactly
 * the kind of thing that is quietly wrong for months.
 *
 * All the instants below are UTC; the church keeps America/Chicago time, so
 * the conversion is part of what is under test. A member opening the site from
 * another timezone should still be told when the service starts *at church*.
 */

// 2026-09-12 is a Saturday. CDT is UTC-5 in September.
const at = (iso: string) => new Date(iso);

describe('churchClock', () => {
  it('reads the church wall clock, not the viewer’s', () => {
    // 02:30 UTC Sunday is still 21:30 Saturday in Garland.
    expect(churchClock(at('2026-09-13T02:30:00Z'))).toEqual({ day: 6, minutes: 21 * 60 + 30 });
  });

  it('handles midnight without rolling the hour to 24', () => {
    // 05:10 UTC is 00:10 in Garland.
    const { minutes } = churchClock(at('2026-09-13T05:10:00Z'));
    expect(minutes).toBe(10);
  });
});

describe('findNextService', () => {
  it('points at Sunday’s liturgy from mid-week', () => {
    // Wednesday afternoon in Garland.
    const next = findNextService(at('2026-09-09T19:00:00Z'));
    expect(next).not.toBeNull();
    expect(next!.item.key).toBe('divineLiturgy');
    expect(next!.dayKey).toBe('sunday');
    expect(next!.daysAhead).toBe(4);
  });

  it('says "today" while Sunday’s liturgy is still ahead', () => {
    // 09:00 UTC Sunday = 04:00 in Garland, before the 06:00 liturgy.
    const next = findNextService(at('2026-09-13T09:00:00Z'));
    expect(next!.daysAhead).toBe(0);
  });

  it('rolls to next week once the liturgy has started', () => {
    // 13:00 UTC Sunday = 08:00 in Garland, after the 06:00 liturgy.
    const next = findNextService(at('2026-09-13T13:00:00Z'));
    expect(next!.daysAhead).toBe(7);
  });

  it('never returns a day more than a week out', () => {
    for (let hour = 0; hour < 24 * 7; hour += 1) {
      const now = new Date(Date.UTC(2026, 8, 7, hour));
      const next = findNextService(now);
      expect(next).not.toBeNull();
      expect(next!.daysAhead).toBeGreaterThanOrEqual(0);
      expect(next!.daysAhead).toBeLessThanOrEqual(7);
    }
  });

  it('leads with the liturgy rather than the 3 AM prayers', () => {
    // Morning prayers are real and listed in the full schedule, but they are
    // not the answer to "when is the next service".
    const next = findNextService(at('2026-09-09T19:00:00Z'));
    expect(next!.item.key).not.toBe('morningPrayers');
  });
});

describe('formatting', () => {
  it('renders noon and midnight the way the parish publishes them', () => {
    expect(formatTime(0)).toBe('12:00 AM');
    expect(formatTime(12 * 60)).toBe('12:00 PM');
    expect(formatTime(6 * 60)).toBe('6:00 AM');
    expect(formatTime(19 * 60 + 45)).toBe('7:45 PM');
  });

  it('drops the dash when no end time is published', () => {
    expect(formatRange({ key: 'x', start: 3 * 60 })).toBe('3:00 AM');
    expect(formatRange({ key: 'x', start: 18 * 60, end: 20 * 60 })).toBe('6:00 PM - 8:00 PM');
  });
});

describe('the schedule itself', () => {
  it('marks exactly one service as the one to lead with', () => {
    const primaries = SERVICE_SCHEDULE.flatMap((b) => b.items.filter((i) => i.primary));
    expect(primaries).toHaveLength(1);
    expect(primaries[0].key).toBe('divineLiturgy');
  });

  it('keeps every item inside a single day', () => {
    const walk = (items: typeof SERVICE_SCHEDULE[number]['items']) => {
      items.forEach((item) => {
        expect(item.start).toBeGreaterThanOrEqual(0);
        expect(item.start).toBeLessThan(24 * 60);
        if (item.end !== undefined) {
          expect(item.end).toBeGreaterThan(item.start);
          expect(item.end).toBeLessThanOrEqual(24 * 60);
        }
        if (item.children) walk(item.children);
      });
    };
    SERVICE_SCHEDULE.forEach((block) => walk(block.items));
  });
});
