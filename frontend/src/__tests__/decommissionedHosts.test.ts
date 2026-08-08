import * as fs from 'fs';
import * as path from 'path';

/**
 * The backend used to run on Render's free tier, which spun down when idle —
 * so the homepage fired a "warm-up" ping at it on every visit to absorb the
 * cold start. The backend now runs on OCI Compute under pm2 and never spins
 * down, but the ping outlived it: it kept firing at the dead Render host on
 * every page load, returning 503, invisible because the hook swallowed its
 * own errors. It was only ever noticed while reading a console log for an
 * unrelated production incident.
 *
 * A hardcoded host that no longer exists produces no test failure and no user
 * -visible symptom, so nothing else in the suite would catch it coming back.
 * This scans source for hosts we have decommissioned. Backends belong behind
 * REACT_APP_API_URL; a literal origin in source cannot be repointed per
 * environment and will rot the same way this one did.
 */

const SRC = path.join(__dirname, '..');

const DECOMMISSIONED_HOSTS = [
  // Former Render free-tier backend, replaced by OCI Compute.
  'abune-aregawi-firebase.onrender.com',
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const sourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
};

describe('decommissioned hosts', () => {
  const files = sourceFiles(SRC).filter((f) => f !== __filename);

  it.each(DECOMMISSIONED_HOSTS)('no source file references %s', (host) => {
    const offenders = files
      .filter((file) => fs.readFileSync(file, 'utf8').includes(host))
      .map((file) => path.relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
