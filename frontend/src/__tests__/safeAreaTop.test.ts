import * as fs from 'fs';
import * as path from 'path';

/**
 * The installed PWA renders its content UNDERNEATH the iOS status bar and
 * Dynamic Island: public/index.html sets viewport-fit=cover together with
 * apple-mobile-web-app-status-bar-style=black-translucent. In mobile Safari
 * the browser chrome pushes content down and this is invisible; in the
 * installed app nothing does.
 *
 * The mobile shell handled this at the BOTTOM (pb-safe-b on BottomNav, the
 * bottom-nav/above-nav spacing tokens) and nowhere at the top. So the fixed
 * top nav — a plain h-16 bar at top:0 — sat entirely beneath the status bar
 * on a notched iPhone. Its hamburger button was not merely hard to hit, it
 * was invisible, which took the language switcher, the home link, and the
 * Sign In button for signed-out visitors with it.
 *
 * Nothing else in the suite can catch this: env(safe-area-inset-top) is
 * always 0 in jsdom and in a desktop browser, so the bug is invisible
 * everywhere except a real notched device in standalone mode. These are
 * source assertions for that reason — they are the only automated guard
 * that the compensation stays in place.
 */

const SRC = path.join(__dirname, '..');

const read = (relative: string): string =>
  fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('top safe-area inset', () => {
  it('gives the fixed top nav a top inset, or it hides under the status bar', () => {
    const nav = read('components/Navigation.tsx');

    // The <nav> is fixed at top:0. Without padding for the inset, its whole
    // content row renders beneath the status bar in standalone mode.
    const navElement = nav.match(/<nav className="([^"]*)"/);
    expect(navElement).not.toBeNull();
    expect(navElement![1]).toContain('pt-safe-t');
  });

  it('defines the tokens the top inset needs', () => {
    const config = fs.readFileSync(
      path.join(SRC, '..', 'tailwind.config.js'),
      'utf8'
    );

    // Mirrors the bottom trio (safe-b / bottom-nav / above-nav) that the
    // mobile shell already ships.
    expect(config).toContain("'safe-t': 'env(safe-area-inset-top)'");
    expect(config).toContain('top-nav');
    expect(config).toContain('env(safe-area-inset-top)');
  });

  it('has no page still clearing the nav with a bare pt-16', () => {
    // Every one of these existed solely to clear the 64px fixed nav. Once the
    // nav grows by the status-bar inset, a literal pt-16 leaves the top of the
    // page underneath it — the same class of bug, moved down one element.
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          walk(full);
          continue;
        }
        if (!['.tsx', '.ts'].includes(path.extname(entry.name))) continue;
        const body = fs.readFileSync(full, 'utf8');
        // Word-boundary so pt-16 does not match inside e.g. "pt-160".
        if (/\bpt-16\b/.test(body)) {
          offenders.push(path.relative(SRC, full));
        }
      }
    };
    walk(SRC);

    expect(offenders).toEqual([]);
  });
});
