import { stripIdentifiers, setRoleGroup, buildEventData } from '../analytics';

/**
 * The only part of the analytics module worth testing in isolation: what it
 * refuses to send. The rest is a script tag.
 */
describe('stripIdentifiers', () => {
  it('drops query strings, which carry phone and memberId on some routes', () => {
    expect(stripIdentifiers('/dues?memberId=482&phone=%2B14695550111')).toBe('/dues');
    expect(stripIdentifiers('/register?email=someone@example.com')).toBe('/register');
  });

  it('replaces numeric path segments so member and department ids are not stored', () => {
    expect(stripIdentifiers('/departments/17')).toBe('/departments/:id');
    expect(stripIdentifiers('/departments/17/meetings/204')).toBe('/departments/:id/meetings/:id');
  });

  it('replaces uuid segments, which announcements and gallery folders use', () => {
    expect(stripIdentifiers('/gallery/3f2504e0-4f89-11d3-9a0c-0305e82c3301'))
      .toBe('/gallery/:id');
  });

  it('replaces opaque high-entropy segments, e.g. a Firebase UID, which are neither numeric nor UUID-shaped', () => {
    // Real shape: AuthContext hits this route on every sign-in.
    expect(stripIdentifiers('/api/members/profile/firebase/Xk3mZq9LpR2sTuVwYz01AbCdEf23'))
      .toBe('/api/members/profile/firebase/:id');
  });

  it('does not mask a short mixed-case segment, which a Firebase UID would never be', () => {
    // Guards against the high-entropy rule swallowing ordinary short segments.
    expect(stripIdentifiers('/aB3')).toBe('/aB3');
  });

  it('leaves every real app route intact (frontend/src/App.tsx), so the high-entropy rule cannot over-mask real routes', () => {
    [
      '/',
      '/login',
      '/register',
      '/dashboard',
      '/admin',
      '/treasurer',
      '/outreach',
      '/sms',
      '/profile',
      '/credits',
      '/donate',
      '/dues',
      '/church-bylaw',
      '/dependents',
      '/parish-pulse-sign-up',
      '/pledge',
      '/thank-you',
      '/privacy',
      '/calendar',
      '/departments',
      '/admin/voicemails',
      '/board-members',
      '/gallery',
    ].forEach((p) => {
      expect(stripIdentifiers(p)).toBe(p);
    });
  });
});

describe('role_group tagging', () => {
  afterEach(() => {
    // Module-level state; leaving it set would leak into later tests.
    setRoleGroup('visitor');
  });

  it('defaults to visitor before any auth state is published', () => {
    expect(buildEventData()).toEqual({ role_group: 'visitor' });
  });

  it('tags outgoing data with the current group', () => {
    setRoleGroup('staff');
    expect(buildEventData({ count: 3 })).toEqual({ count: 3, role_group: 'staff' });
  });

  it('lets the group change when a member signs in or out', () => {
    setRoleGroup('member');
    expect(buildEventData().role_group).toBe('member');
    setRoleGroup('visitor');
    expect(buildEventData().role_group).toBe('visitor');
  });

  it('carries a group, never an identity', () => {
    setRoleGroup('staff');
    const serialized = JSON.stringify(buildEventData({ count: 2 }));
    // The whole point of a coarse bucket: nothing here can single out a member.
    expect(serialized).not.toMatch(/treasurer|admin|memberId|member_id|phone|email/i);
    expect(Object.keys(buildEventData())).toEqual(['role_group']);
  });
});
