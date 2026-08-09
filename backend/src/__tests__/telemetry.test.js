const { scrubEvent } = require('../utils/telemetry');

describe('scrubEvent', () => {
  // --- from the brief -----------------------------------------------------

  it('never lets an email or phone survive', () => {
    const event = {
      request: {
        url: 'https://api.example.org/api/members/profile/firebase/abc?email=someone@example.com',
        data: { phone_number: '+14695550111', amount_due: 250 },
        headers: { authorization: 'Bearer abc123' },
      },
      user: { email: 'someone@example.com', id: 482 },
    };
    const serialized = JSON.stringify(scrubEvent(event) ?? {});
    expect(serialized).not.toMatch(/someone@example\.com/);
    expect(serialized).not.toMatch(/4695550111/);
    expect(serialized).not.toMatch(/Bearer abc123/);
  });

  it('never attaches a request body, which carries dues and member records', () => {
    const event = { request: { data: { amount_due: 250, member_id: 482 } } };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request.data).toBeUndefined();
  });

  it('strips query strings from the url', () => {
    const event = { request: { url: 'https://api.example.org/api/members?phone=%2B14695550111' } };
    expect(scrubEvent(event).request.url).not.toMatch(/phone|4695550111/);
  });

  it('keeps the diagnostic fields worth having', () => {
    const event = { request: { url: 'https://api.example.org/api/members', method: 'POST' } };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request.method).toBe('POST');
    expect(scrubbed.request.url).toContain('/api/members');
  });

  it('drops event.user even when its fields are not on redactSensitive\'s known-name list', () => {
    // redactSensitive (the backstop) recognizes the *key name* `email`
    // wherever it appears, so a naive test using `user.email` would pass
    // even without the explicit `delete event.user` below — the backstop
    // would catch it by accident. `username` is not on redactSensitive's
    // fixed list, so this only passes if event.user is actually deleted.
    const event = { user: { id: 482, username: 'jdoe482' } };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.user).toBeUndefined();
  });

  // --- extra.deep-dive fields beyond the brief -----------------------------
  // Node's default Sentry integrations (requestData, http, console) populate
  // several fields the frontend equivalent didn't have to worry about. Each
  // test below is paired with its own break/restore check during manual
  // verification (see task-7-report.md) so a vacuous assertion can't hide.

  it('drops request.headers entirely, not just the Authorization key', () => {
    const event = { request: { headers: { 'x-forwarded-for': '1.2.3.4', cookie: 'session=abc' } } };
    expect(scrubEvent(event).request.headers).toBeUndefined();
  });

  it('drops request.cookies', () => {
    const event = { request: { cookies: { session: 'abc123' } } };
    expect(scrubEvent(event).request.cookies).toBeUndefined();
  });

  it('drops request.query_string, which Sentry populates independently of request.url', () => {
    const event = { request: { query_string: 'phone=%2B14695550111&email=someone@example.com' } };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request.query_string).toBeUndefined();
  });

  it('drops request.env, which can carry the client IP (REMOTE_ADDR)', () => {
    const event = { request: { env: { REMOTE_ADDR: '203.0.113.7' } } };
    expect(scrubEvent(event).request.env).toBeUndefined();
  });

  it('drops event.extra entirely', () => {
    const event = { extra: { memberEmail: 'someone@example.com', note: 'internal debug note' } };
    expect(scrubEvent(event).extra).toBeUndefined();
  });

  describe('breadcrumbs', () => {
    // Sentry's default Node integrations record breadcrumbs Sentry.init()
    // never asks the app for: the Console integration mirrors every
    // console.log/console.error call (and this codebase logs raw member
    // objects that way in places), and the Http integration records every
    // outgoing/incoming HTTP call with a `data['http.query']` field carrying
    // the RAW, unsanitized query string (confirmed by reading
    // @sentry/core's add-outgoing-request-breadcrumb.js). Neither passes
    // through event.request, so scrubbing request.* alone would miss both.

    it('drops data and message from an unrecognized/unsafe breadcrumb category (console)', () => {
      const event = {
        breadcrumbs: [
          {
            category: 'console',
            level: 'error',
            message: 'Failed to save member someone@example.com +14695550111',
            data: { arguments: [{ email: 'someone@example.com', phone_number: '+14695550111' }] },
          },
        ],
      };
      const serialized = JSON.stringify(scrubEvent(event));
      expect(serialized).not.toMatch(/someone@example\.com/);
      expect(serialized).not.toMatch(/4695550111/);
      // category/level survive so the trail still shows *that* something happened
      expect(scrubEvent(event).breadcrumbs[0].category).toBe('console');
    });

    it('keeps an allowlisted field subset for the http category but drops the raw query string', () => {
      const event = {
        breadcrumbs: [
          {
            category: 'http',
            type: 'http',
            level: 'info',
            data: {
              url: 'https://api.example.org/api/members/profile/firebase/abc',
              status_code: 200,
              'http.method': 'GET',
              'http.query': '?email=someone@example.com&phone=%2B14695550111',
              'http.fragment': '#someone@example.com',
            },
          },
        ],
      };
      const scrubbed = scrubEvent(event);
      const serialized = JSON.stringify(scrubbed);
      expect(serialized).not.toMatch(/someone@example\.com/);
      expect(serialized).not.toMatch(/4695550111/);
      expect(scrubbed.breadcrumbs[0].data.status_code).toBe(200);
    });
  });

  describe('tags', () => {
    // reportError(error, context) puts context straight into event.tags.
    // Today's only call site passes { route, method }, but the allowlist is
    // the guard against a future call site adding something like
    // { memberId, phone } "for debugging" — enforced at the one choke point
    // every event passes through, not by trusting every call site.

    it('drops a tag key that is not on the allowlist', () => {
      const event = { tags: { route: '/api/members/:id', memberEmail: 'someone@example.com' } };
      const scrubbed = scrubEvent(event);
      expect(scrubbed.tags.memberEmail).toBeUndefined();
      expect(scrubbed.tags.route).toBe('/api/members/:id');
    });

    it('drops an allowed key anyway if its value looks like an email or phone', () => {
      const event = { tags: { route: 'someone@example.com' } };
      const scrubbed = scrubEvent(event);
      expect(scrubbed.tags.route).toBeUndefined();
    });

    it('drops a non-allowlisted key even when its value is not PII-shaped', () => {
      // Isolates the allowlist from the PII-value check. The two tests above
      // both use PII-shaped values (an email address), so either control
      // alone would make them pass — they don't prove the allowlist itself
      // is doing anything. A value like '482' matches neither EMAIL_PATTERN
      // nor PHONE_PATTERN, so the PII-value check has nothing to catch here;
      // this only passes if ALLOWED_TAG_KEYS.has(key) is actually filtering.
      const event = { tags: { route: '/api/members/:id', memberId: '482' } };
      const scrubbed = scrubEvent(event);
      expect(scrubbed.tags.memberId).toBeUndefined();
      expect(scrubbed.tags.route).toBe('/api/members/:id');
    });
  });

  describe('exception message', () => {
    // error.message is free text set by whatever code threw the error.
    // Nothing in this codebase currently interpolates PII into an Error
    // message (checked via grep), but nothing stops it happening in a
    // service file six months from now. redactSensitive can't help here —
    // it only inspects known field *names* on objects, and a plain string
    // like "Duplicate phone: +14695550111" has no field name to key off of.
    // Pattern-redact rather than drop outright: the exception value is the
    // single most useful field in the Sentry UI for triage, so gutting it
    // entirely would defeat the point of shipping this at all.

    it('redacts an email or phone embedded in the exception message', () => {
      const event = {
        exception: {
          values: [{ type: 'Error', value: 'Duplicate phone +14695550111 for someone@example.com' }],
        },
      };
      const serialized = JSON.stringify(scrubEvent(event));
      expect(serialized).not.toMatch(/4695550111/);
      expect(serialized).not.toMatch(/someone@example\.com/);
    });

    it('leaves a PII-free exception message untouched', () => {
      const event = { exception: { values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }] } };
      expect(scrubEvent(event).exception.values[0].value).toBe('Cannot read properties of undefined');
    });
  });
});
