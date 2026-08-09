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
    // isErrorTrackingEnabled() short-circuits on `!DSN` before it ever reaches
    // the doNotTrack check, and DSN is read from process.env once at module
    // load. With no REACT_APP_SENTRY_DSN set in the test environment (the
    // normal case), that first gate alone makes the function return false —
    // toggling doNotTrack would prove nothing, since the DNT branch is never
    // reached. To actually exercise the DNT branch, this re-imports the
    // module with the DSN gate deliberately open (DSN set, NODE_ENV forced to
    // 'production') so DNT is the thing being tested, not the DSN gate.
    const originalDsn = process.env.REACT_APP_SENTRY_DSN;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDnt = navigator.doNotTrack;

    jest.resetModules();
    process.env.REACT_APP_SENTRY_DSN = 'https://example.ingest.sentry.io/1';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const withDsn = require('../errorTracking') as typeof import('../errorTracking');
    process.env.NODE_ENV = 'production';

    try {
      Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
      expect(withDsn.isErrorTrackingEnabled()).toBe(false);

      // Sanity check that DNT is really the gate under test here: with the
      // DSN+production setup unchanged and only DNT cleared, tracking must
      // be enabled. Without this, a no-op DNT check would pass silently.
      Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true });
      expect(withDsn.isErrorTrackingEnabled()).toBe(true);
    } finally {
      Object.defineProperty(navigator, 'doNotTrack', { value: originalDnt, configurable: true });
      process.env.NODE_ENV = originalNodeEnv;
      process.env.REACT_APP_SENTRY_DSN = originalDsn;
      jest.resetModules();
    }
  });
});

describe('scrubEvent breadcrumbs', () => {
  it('strips identifiers from fetch/xhr/navigation breadcrumb URLs, which bypass request.url scrubbing entirely', () => {
    const event = {
      breadcrumbs: [
        {
          category: 'fetch',
          type: 'http',
          data: {
            method: 'GET',
            url: 'https://example.org/api/members/profile/firebase/482?email=someone%40example.com&phone=%2B14695550111',
            status_code: 200,
          },
        },
        {
          category: 'navigation',
          data: { from: '/dashboard', to: '/departments/17/meetings/204?memberId=482' },
        },
      ],
    };
    const scrubbed = scrubEvent(event as any);
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toMatch(/someone@example\.com/);
    expect(serialized).not.toMatch(/4695550111/);
    expect(serialized).not.toMatch(/"482"|\/482|memberId/);
    expect(scrubbed!.breadcrumbs![0].data).toEqual({
      method: 'GET',
      status_code: 200,
      url: '/api/members/profile/firebase/:id',
    });
    expect(scrubbed!.breadcrumbs![1].data).toEqual({ from: '/dashboard', to: '/departments/:id/meetings/:id' });
  });

  it('drops data and message from breadcrumb categories with no vetted shape, e.g. console logs', () => {
    const event = {
      breadcrumbs: [
        {
          category: 'console',
          level: 'log',
          message: 'member phone is +14695550111',
          data: { arguments: ['member phone is +14695550111'], logger: 'console' },
        },
      ],
    };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.breadcrumbs![0]).toEqual({ category: 'console', level: 'log' });
    expect(JSON.stringify(scrubbed)).not.toMatch(/4695550111/);
  });
});

describe('scrubEvent tags', () => {
  it('drops reportError context keys that are not on the tag allowlist, so a phone or member id cannot survive', () => {
    const event = {
      tags: { component: 'ErrorBoundary', memberId: '482', phone: '+14695550111', email: 'someone@example.com' },
    };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.tags).toEqual({ component: 'ErrorBoundary' });
  });

  it('drops an allowlisted tag anyway if its value looks like an email or phone number', () => {
    const event = { tags: { component: '+14695550111', boundary: 'someone@example.com' } };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.tags).toEqual({});
  });
});
