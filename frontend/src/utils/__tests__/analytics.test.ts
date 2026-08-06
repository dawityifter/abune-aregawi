import { stripIdentifiers } from '../analytics';

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

  it('leaves ordinary routes intact so the data is still useful', () => {
    ['/', '/dashboard', '/donate', '/church-bylaw', '/board-members'].forEach((p) => {
      expect(stripIdentifiers(p)).toBe(p);
    });
  });
});
