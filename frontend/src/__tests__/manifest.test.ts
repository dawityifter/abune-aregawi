import * as fs from 'fs';
import * as path from 'path';

/**
 * The manifest used to declare a 512x512 icon whose src was the 192px file.
 * Chrome refuses the rich install prompt on that alone, and it fails silently —
 * nothing in the build or the typecheck notices. These assertions are the guard.
 */

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const manifest = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8')
);

const iconFor = (sizes: string) =>
  manifest.icons.find((i: any) => i.sizes === sizes);

describe('PWA manifest', () => {
  it('declares an id and a scope', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('uses the parish red as the theme color', () => {
    // primary-700, where the nav gradient starts.
    expect(manifest.theme_color).toBe('#991b1b');
  });

  it('points the 512 icon at a genuinely 512px file', () => {
    const icon = iconFor('512x512');
    expect(icon).toBeDefined();
    expect(icon.src).not.toContain('192');
    expect(fs.existsSync(path.join(PUBLIC, icon.src))).toBe(true);
  });

  it('declares a maskable icon', () => {
    const maskable = manifest.icons.find((i: any) => i.purpose === 'maskable');
    expect(maskable).toBeDefined();
    expect(fs.existsSync(path.join(PUBLIC, maskable.src))).toBe(true);
  });

  it('every declared icon file exists', () => {
    manifest.icons.forEach((i: any) => {
      expect(fs.existsSync(path.join(PUBLIC, i.src))).toBe(true);
    });
  });

  it('is installable as a standalone app', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });
});
