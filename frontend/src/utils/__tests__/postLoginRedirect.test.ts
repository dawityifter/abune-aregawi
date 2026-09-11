import { resolvePostLoginPath } from '../postLoginRedirect';

// Where a member lands after signing in. Two separate entry points record an
// intended destination — ProtectedRoute bouncing a signed-out visitor off a
// protected page, and the pledge page's "sign in to pledge" card — and before
// this helper existed neither was ever read: everyone landed on /dashboard.
describe('resolvePostLoginPath', () => {
  it('leaves a member where they are when they signed in mid-page', () => {
    // Signing in from a protected page they already reached should not yank
    // them somewhere else.
    expect(resolvePostLoginPath('/dues', undefined)).toBeNull();
  });

  it('sends a member to the dashboard when nothing was recorded', () => {
    expect(resolvePostLoginPath('/login', undefined)).toBe('/dashboard');
  });

  it('returns the member to the page that sent them to sign in', () => {
    expect(resolvePostLoginPath('/login', '/pledge')).toBe('/pledge');
  });

  it("accepts ProtectedRoute's location object, preserving the query string", () => {
    // ProtectedRoute records `state={{ from: location }}` — a location object,
    // not a string — so the helper has to understand both shapes.
    expect(resolvePostLoginPath('/login', { pathname: '/dues', search: '?year=2026' }))
      .toBe('/dues?year=2026');
  });

  it('refuses to bounce a member to another site', () => {
    // `from` reaches this through router state, so it must never be trusted
    // as a redirect target without checking it stays on this origin.
    expect(resolvePostLoginPath('/login', 'https://evil.test/steal')).toBe('/dashboard');
    expect(resolvePostLoginPath('/login', '//evil.test/steal')).toBe('/dashboard');
  });

  it('never sends a member back to the login page', () => {
    expect(resolvePostLoginPath('/login', '/login')).toBe('/dashboard');
  });
});
