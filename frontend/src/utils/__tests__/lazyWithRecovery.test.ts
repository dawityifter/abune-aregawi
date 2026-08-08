import { loadWithRecovery } from '../lazyWithRecovery';

/**
 * loadWithRecovery is the async factory lazyWithRecovery wraps in
 * React.lazy(). Testing it directly (rather than through a rendered
 * component) lets these assert on the recovery side effects — postMessage,
 * registration.update(), reload — without needing Suspense/ErrorBoundary
 * scaffolding.
 */

const RECOVERY_KEY = 'app.chunkLoadRecoveryAttempted';

function chunkLoadError(message = 'Loading chunk 3 failed.'): Error {
  const error = new Error(message);
  error.name = 'ChunkLoadError';
  return error;
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Jest 27.5.1 (this project's pinned version) does not have
 * jest.advanceTimersByTimeAsync — only the synchronous advanceTimersByTime.
 * Under fake timers, setTimeout is faked but Promise microtasks are not, so
 * the recovery chain's several `await`s still need real ticks to actually
 * run; this drains the microtask queue without touching the timer clock.
 */
async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

function createWorker() {
  return { postMessage: jest.fn() };
}

/** Minimal fake of a ServiceWorker still installing, driving its own 'statechange'. */
function createInstallingWorker() {
  const listeners: Array<() => void> = [];
  const worker: any = {
    state: 'installing',
    postMessage: jest.fn(),
    addEventListener: jest.fn((event: string, cb: () => void) => {
      if (event === 'statechange') listeners.push(cb);
    }),
    removeEventListener: jest.fn((event: string, cb: () => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
  };
  worker.setState = (state: string) => {
    worker.state = state;
    listeners.slice().forEach((cb) => cb());
  };
  return worker;
}

/**
 * Fake of navigator.serviceWorker. `registration` is a plain mutable object
 * so tests can simulate registration.update() populating `.waiting` or
 * `.installing`, exactly as the real browser would between the update()
 * promise resolving and the worker reaching later lifecycle states.
 */
function installMockServiceWorker(registration: {
  waiting?: any;
  installing?: any;
  update?: jest.Mock;
} = {}) {
  const reg: any = {
    waiting: registration.waiting ?? null,
    installing: registration.installing ?? null,
    update: registration.update ?? jest.fn().mockResolvedValue(undefined),
  };
  const listeners: Record<string, Array<() => void>> = {};
  const container = {
    getRegistration: jest.fn().mockResolvedValue(reg),
    addEventListener: jest.fn((event: string, cb: () => void) => {
      (listeners[event] = listeners[event] || []).push(cb);
    }),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  return {
    container,
    registration: reg,
    fireControllerChange: () => (listeners.controllerchange || []).forEach((cb) => cb()),
  };
}

const originalLocation = window.location;

describe('loadWithRecovery', () => {
  let reloadSpy: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    // jsdom's window.location.reload is non-configurable, so jest.spyOn (and
    // even Object.defineProperty on the existing object) throws "Cannot
    // redefine property". The whole `location` property on `window` itself
    // is configurable, so it is replaced wholesale instead.
    reloadSpy = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    delete (navigator as any).serviceWorker;
    jest.useRealTimers();
  });

  it('recovers from a chunk-load failure by activating an already-waiting worker and reloading, once', async () => {
    const waiting = createWorker();
    const sw = installMockServiceWorker({ waiting });
    const factory = jest.fn().mockRejectedValue(chunkLoadError());

    // Fire and forget: on a successful recovery path the returned promise
    // deliberately never settles (see loadWithRecovery's doc comment).
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadWithRecovery(factory);

    await tick();
    await tick();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(sw.registration.update).not.toHaveBeenCalled(); // already waiting; no forced check needed
    expect(sessionStorage.getItem(RECOVERY_KEY)).toBe('1');
    expect(reloadSpy).not.toHaveBeenCalled();

    sw.fireControllerChange();
    await tick();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('rethrows on a second chunk-load failure instead of looping', async () => {
    const waiting = createWorker();
    installMockServiceWorker({ waiting });

    // First failure: recovery attempt kicks off (fire and forget).
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadWithRecovery(jest.fn().mockRejectedValue(chunkLoadError()));
    await tick();
    await tick();
    expect(waiting.postMessage).toHaveBeenCalledTimes(1);

    // Second failure in the same session: must not attempt recovery again.
    const secondError = chunkLoadError('Loading chunk 3 failed.');
    await expect(loadWithRecovery(jest.fn().mockRejectedValue(secondError))).rejects.toBe(secondError);
    expect(waiting.postMessage).toHaveBeenCalledTimes(1);
  });

  it('does not attempt recovery, and rethrows, when a non-chunk error occurs', async () => {
    const waiting = createWorker();
    installMockServiceWorker({ waiting });

    const error = new Error('Network request failed');
    await expect(loadWithRecovery(jest.fn().mockRejectedValue(error))).rejects.toBe(error);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RECOVERY_KEY)).toBeNull();
  });

  it('resolves normally when the factory succeeds', async () => {
    const mod = { default: () => null };
    await expect(loadWithRecovery(jest.fn().mockResolvedValue(mod))).resolves.toBe(mod);
  });

  it('rethrows a chunk-load error when update() finds nothing new (no waiting, no installing)', async () => {
    installMockServiceWorker({});
    const error = chunkLoadError();
    await expect(loadWithRecovery(jest.fn().mockRejectedValue(error))).rejects.toBe(error);
  });

  it('forces registration.update() and activates the worker it turns up waiting (client-side-navigation-only tab)', async () => {
    const waiting = createWorker();
    // Simulates the tab having stayed open across a deploy with no full page
    // load: nothing was waiting, but the forced update() check finds one.
    const update = jest.fn().mockImplementation(async () => {
      sw.registration.waiting = waiting;
    });
    const sw = installMockServiceWorker({ update });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadWithRecovery(jest.fn().mockRejectedValue(chunkLoadError()));

    await tick();
    await tick();
    expect(update).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    sw.fireControllerChange();
    await tick();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('forces registration.update(), waits for an installing worker to finish, then activates it', async () => {
    const installing = createInstallingWorker();
    const update = jest.fn().mockResolvedValue(undefined);
    const sw = installMockServiceWorker({ installing, update });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadWithRecovery(jest.fn().mockRejectedValue(chunkLoadError()));

    await tick();
    await tick();
    expect(update).toHaveBeenCalledTimes(1);
    expect(installing.postMessage).not.toHaveBeenCalled(); // still installing; nothing sent yet

    installing.setState('installed');
    await tick();
    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    sw.fireControllerChange();
    await tick();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('treats an offline registration.update() rejection as "no new worker" and rethrows the original chunk error', async () => {
    const update = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    installMockServiceWorker({ update });

    const error = chunkLoadError();
    await expect(loadWithRecovery(jest.fn().mockRejectedValue(error))).rejects.toBe(error);
    expect(update).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('gives up and rethrows if an installing worker never reaches "installed"', async () => {
    jest.useFakeTimers('modern');
    const installing = createInstallingWorker();
    const update = jest.fn().mockResolvedValue(undefined);
    installMockServiceWorker({ installing, update });

    const error = chunkLoadError();
    const promise = loadWithRecovery(jest.fn().mockRejectedValue(error));
    // Tracked independently of the `rejects` assertion below, so we can
    // check settlement mid-test without consuming the promise the assertion
    // still needs to observe.
    let settled = false;
    promise.catch(() => { settled = true; });
    const assertion = expect(promise).rejects.toBe(error);

    // Let getRegistration()/update() resolve and waitForInstalled's timeout
    // get scheduled. Never call installing.setState(...): the worker hangs
    // in 'installing' the whole time.
    await flushMicrotasks();
    expect(settled).toBe(false);

    // One tick short of the timeout: must still be pending. Without this, a
    // timeout accidentally shortened from 8000ms to (say) 800ms would pass
    // this test just as well.
    jest.advanceTimersByTime(7999);
    await flushMicrotasks();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(settled).toBe(true);

    await assertion;
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    // A statechange arriving after the timeout already gave up must be a
    // no-op — proof waitForInstalled's `settled` guard (and its
    // removeEventListener) actually took effect, not just that nothing
    // happened to fire in this test.
    installing.setState('installed');
    await flushMicrotasks();
    expect(installing.postMessage).not.toHaveBeenCalled();
  });

  it('gives up and rethrows if a waiting worker never takes control (controllerchange never fires)', async () => {
    jest.useFakeTimers('modern');
    const waiting = createWorker();
    const sw = installMockServiceWorker({ waiting });

    const error = chunkLoadError();
    const promise = loadWithRecovery(jest.fn().mockRejectedValue(error));
    let settled = false;
    promise.catch(() => { settled = true; });
    const assertion = expect(promise).rejects.toBe(error);

    // Let postMessage go out and skipWaitingAndReload's timeout get
    // scheduled. The test never fires controllerchange on its own.
    await flushMicrotasks();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(settled).toBe(false);

    // One tick short of the timeout: still pending, guarding against a
    // silently-shortened timeout constant.
    jest.advanceTimersByTime(7999);
    await flushMicrotasks();
    expect(settled).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(settled).toBe(true);

    await assertion;
    expect(reloadSpy).not.toHaveBeenCalled();

    // A controllerchange arriving late, after the timeout already gave up,
    // must not reload after the fact — proof of the `settled` guard inside
    // skipWaitingAndReload, not just an absence of any late event in this test.
    sw.fireControllerChange();
    await flushMicrotasks();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('rethrows if an installing worker becomes redundant (its install was superseded) rather than waiting forever', async () => {
    const installing = createInstallingWorker();
    const update = jest.fn().mockResolvedValue(undefined);
    installMockServiceWorker({ installing, update });

    const error = chunkLoadError();
    const promise = loadWithRecovery(jest.fn().mockRejectedValue(error));
    const assertion = expect(promise).rejects.toBe(error);

    await tick();
    await tick();
    expect(update).toHaveBeenCalledTimes(1);
    expect(installing.postMessage).not.toHaveBeenCalled();

    // The browser can supersede an in-progress install (e.g. a second,
    // newer worker starts installing before this one finishes) — the
    // installing worker's state goes to 'redundant', not 'installed'.
    installing.setState('redundant');
    await tick();

    await assertion;
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
