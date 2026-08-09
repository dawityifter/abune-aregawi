import { scrubEvent, isErrorTrackingEnabled } from '../errorTracking';

describe('scrubEvent', () => {
  it('drops ChunkLoadError, which every deploy produces and the app self-heals', () => {
    const event = { exception: { values: [{ type: 'ChunkLoadError', value: 'Loading chunk 42 failed' }] } };
    expect(scrubEvent(event as any)).toBeNull();
  });

  it('strips query strings, which carry phone and email on some routes', () => {
    const event = {
      request: { url: 'https://example.org/dues?memberId=482&phone=%2B14695550111' },
    };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.request!.url).toBe('/dues');
  });

  it('replaces id path segments so member and department ids are not stored', () => {
    const event = { request: { url: 'https://example.org/departments/17/meetings/204' } };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.request!.url).toBe('/departments/:id/meetings/:id');
  });

  it('never lets a phone number or email survive in any field', () => {
    const event = {
      request: { url: 'https://example.org/profile', headers: { Cookie: 'session=abc' } },
      user: { email: 'someone@example.com', id: '482' },
      extra: { phone: '+14695550111' },
    };
    const serialized = JSON.stringify(scrubEvent(event as any) ?? {});
    expect(serialized).not.toMatch(/someone@example\.com/);
    expect(serialized).not.toMatch(/4695550111/);
    expect(serialized).not.toMatch(/session=abc/);
  });

  it('reports nothing when the member has asked not to be tracked', () => {
    const original = navigator.doNotTrack;
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    expect(isErrorTrackingEnabled()).toBe(false);
    Object.defineProperty(navigator, 'doNotTrack', { value: original, configurable: true });
  });
});
