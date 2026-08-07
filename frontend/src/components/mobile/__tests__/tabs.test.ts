import { resolveActiveTab, TABS } from '../tabs';

/**
 * Every route in the app must light exactly one tab. A route that lights none
 * leaves the bar looking broken; a route that lights two is a bug that only
 * shows up on one screen.
 */

describe('resolveActiveTab', () => {
  it('lights Today on the home page and the dashboard', () => {
    expect(resolveActiveTab('/')).toBe('today');
    expect(resolveActiveTab('/dashboard')).toBe('today');
  });

  it('lights Calendar on the calendar route', () => {
    expect(resolveActiveTab('/calendar')).toBe('calendar');
  });

  it.each(['/donate', '/pledge', '/dues', '/thank-you'])(
    'lights Give on %s',
    (p) => expect(resolveActiveTab(p)).toBe('give')
  );

  it.each([
    '/profile', '/admin', '/treasurer', '/outreach', '/sms', '/gallery',
    '/departments', '/board-members', '/church-bylaw', '/credits', '/privacy',
    '/register', '/login', '/parish-pulse-sign-up', '/dependents'
  ])('falls back to More on %s', (p) => {
    expect(resolveActiveTab(p)).toBe('more');
  });

  it('falls back to More on nested routes', () => {
    expect(resolveActiveTab('/departments/12/meetings/3')).toBe('more');
    expect(resolveActiveTab('/gallery/abc123')).toBe('more');
  });

  it('exposes exactly four tabs', () => {
    expect(TABS.map((t) => t.id)).toEqual(['today', 'calendar', 'give', 'more']);
  });
});
