const { recordLastSeen, THROTTLE_MS } = require('../utils/recordLastSeen');

const makeMember = (lastSeenAt) => ({
  id: 1,
  lastSeenAt,
  update: jest.fn().mockResolvedValue(undefined),
});

describe('recordLastSeen', () => {
  it('writes when the member has never been seen', () => {
    const member = makeMember(null);
    recordLastSeen(member);
    expect(member.update).toHaveBeenCalledTimes(1);
  });

  it('does not write again inside the throttle window', () => {
    const member = makeMember(new Date(Date.now() - 60 * 1000));
    recordLastSeen(member);
    expect(member.update).not.toHaveBeenCalled();
  });

  it('writes again once the window has passed', () => {
    const member = makeMember(new Date(Date.now() - THROTTLE_MS - 1000));
    recordLastSeen(member);
    expect(member.update).toHaveBeenCalledTimes(1);
  });

  it('never throws when the write fails, because a request must not fail over telemetry', async () => {
    const member = makeMember(null);

    // recordLastSeen is fire-and-forget, so it can never throw *synchronously*
    // regardless of whether the returned promise's rejection is handled — that
    // is true even with a missing `.catch()`. The real risk this test must
    // catch is an UNHANDLED PROMISE REJECTION once member.update() rejects
    // asynchronously.
    //
    // Listening for `process.on('unhandledRejection', ...)` from inside a test
    // file does NOT work here: jest-circus (jest's default test runner) runs
    // test files in a VM sandbox with its own `process` object, and only
    // registers its unhandled-rejection handler on the *real* parent process
    // (see node_modules/jest-circus/build/globalErrorHandlers.js) — a listener
    // added from inside the test never fires, so that route would silently
    // assert nothing, exactly the "confounded" failure mode this test must
    // avoid. Instead, watch the promise itself: spy on `.then` (which
    // `Promise.prototype.catch` is implemented in terms of, so this observes
    // both `.catch(fn)` and `.then(ok, fn)` alike) and assert a rejection
    // handler was actually attached before the microtask queue would
    // otherwise flag this promise as unhandled.
    const rejection = Promise.reject(new Error('db down'));
    let rejectionHandlerAttached = false;
    const realThen = rejection.then.bind(rejection);
    rejection.then = (onFulfilled, onRejected) => {
      if (onRejected) rejectionHandlerAttached = true;
      return realThen(onFulfilled, onRejected);
    };
    member.update = jest.fn().mockReturnValue(rejection);

    expect(() => recordLastSeen(member)).not.toThrow();
    // Let the rejection settle before asserting a handler was attached.
    await new Promise((resolve) => setImmediate(resolve));
    expect(rejectionHandlerAttached).toBe(true);
  });

  it('tolerates a missing member without throwing', () => {
    expect(() => recordLastSeen(null)).not.toThrow();
  });
});
