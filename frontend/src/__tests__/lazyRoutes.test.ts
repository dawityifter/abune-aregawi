import * as fs from 'fs';
import * as path from 'path';

/**
 * React.lazy() resolves a module's *default* export. If a lazily-loaded route
 * is ever converted to a named export, nothing fails at build time or in
 * typecheck — the route throws in the member's browser when they navigate to
 * it, and only for that route.
 *
 * This reads App.tsx, finds every lazy() import, and checks the target file
 * still has a default export. It parses rather than imports on purpose: several
 * of these pull Stripe or TipTap, which need mocking to import under Jest, and
 * a guard that needs maintenance is a guard that gets deleted.
 */

const SRC = path.join(__dirname, '..');
const APP = path.join(SRC, 'App.tsx');

const lazyImportPaths = (): string[] => {
  const source = fs.readFileSync(APP, 'utf8');
  // Array.from rather than spread: the tsconfig target predates
  // downlevelIteration, so spreading an iterator fails typecheck.
  // Tolerates an optional /* webpackChunkName: "..." */ between `import(` and
  // the quote: the five staff-only routes carry one so the service worker's
  // precache filter can exclude their chunks by name (see service-worker.js).
  // Without this, those five routes silently drop out of every check below
  // while the suite stays green — exactly the failure mode this file exists
  // to catch.
  const matches = Array.from(
    source.matchAll(/lazy\(\s*\(\)\s*=>\s*import\(\s*(?:\/\*.*?\*\/\s*)?['"](.+?)['"]\s*\)/g)
  );
  return matches.map((m) => m[1]);
};

const resolve = (rel: string): string => {
  const base = path.join(SRC, rel);
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return '';
};

describe('lazily-loaded routes', () => {
  const paths = lazyImportPaths();

  it('finds the lazy imports in App.tsx', () => {
    // Guards the regex itself: if App.tsx is reformatted so this stops matching,
    // the checks below would silently pass over an empty list. Pinned to the
    // real current count (23), not a loose lower bound — a loose bound is how
    // the five webpackChunkName-commented staff routes silently dropped out of
    // this suite the first time around while it kept reporting green.
    expect(paths.length).toBe(23);
  });

  it.each(lazyImportPaths())('%s resolves to a real file', (rel) => {
    expect(resolve(rel)).not.toBe('');
  });

  it.each(lazyImportPaths())('%s has a default export', (rel) => {
    const file = resolve(rel);
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toMatch(/^export default/m);
  });

  it('does not lazily load the routes that carry first-paint traffic', () => {
    // Home, sign-in, and the dashboard are where nearly all traffic lands.
    // Splitting them would add a spinner to the common path and save nothing.
    const source = fs.readFileSync(APP, 'utf8');
    ['./components/HomePage', './components/auth/SignIn', './components/Dashboard'].forEach((p) => {
      expect(source).toMatch(new RegExp(`^import \\w+ from '${p.replace(/\//g, '\\/')}'`, 'm'));
    });
    expect(paths).not.toContain('./components/HomePage');
    expect(paths).not.toContain('./components/Dashboard');
  });

  it('wraps the routes in a Suspense boundary', () => {
    // lazy() without Suspense throws on first navigation.
    const source = fs.readFileSync(APP, 'utf8');
    expect(source).toMatch(/<Suspense[\s\S]*<Routes>/);
  });

  it('wraps Suspense/Routes in an ErrorBoundary', () => {
    // A rejected React.lazy() factory (e.g. a chunk failing to load offline)
    // propagates past Suspense as a thrown error. With no ErrorBoundary above
    // it, React unmounts the *entire* tree, not just the route content —
    // taking Navigation/BottomNav down with it and leaving a blank #root.
    // That's especially bad on an installed PWA: no browser chrome, no
    // address bar, no back button, just a white screen. This asserts the
    // boundary sits outside Suspense/Routes, not merely present somewhere
    // in the file.
    const source = fs.readFileSync(APP, 'utf8');
    expect(source).toMatch(/<ErrorBoundary>[\s\S]*<Suspense[\s\S]*<Routes>/);
  });
});
