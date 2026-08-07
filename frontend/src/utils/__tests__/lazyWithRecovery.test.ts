import { loadWithRecovery } from '../lazyWithRecovery';

/**
 * loadWithRecovery is the async factory lazyWithRecovery wraps in
 * React.lazy(). Testing it directly (rather than through a rendered
 * component) lets these assert on the recovery side effects — postMessage,
 * reload — without needing Suspense/ErrorBoundary scaffolding.
 */

function chunkLoadError(message = 'Loading chunk 3 failed.'): Error {
  const error = new Error(message);
  error.name = 'ChunkLoadError';
  return error;
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Minimal fake of navigator.serviceWorker with a worker already waiting. */
function installMockServiceWorker(waiting: { postMessage: jest.Mock } | null) {
  const listeners: Record<string, Array<() => void>> = {};
  const container = {
    getRegistration: jest.fn().mockResolvedValue(waiting ? { waiting } : {}),
    addEventListener: jest.fn((event: string, cb: () => void) => {
      (listeners[event] = listeners[event] || []).push(cb);
    }),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  return {
    container,
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
    // @ts-expect-error - test-only cleanup of a property we defined ourselves
    delete (navigator as any).serviceWorker;
  });

  it('recovers from a chunk-load failure by activating the waiting worker and reloading, once', async () => {
    const waiting = { postMessage: jest.fn() };
    const sw = installMockServiceWorker(waiting);
    const factory = jest.fn().mockRejectedValue(chunkLoadError());

    // Fire and forget: on a successful recovery path the returned promise
    // deliberately never settles (see loadWithRecovery's doc comment).
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadWithRecovery(factory);

    await tick();
    await tick();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(sessionStorage.getItem('app.chunkLoadRecoveryAttempted')).toBe('1');
    expect(reloadSpy).not.toHaveBeenCalled();

    sw.fireControllerChange();
    await tick();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('rethrows on a second chunk-load failure instead of looping', async () => {
    const waiting = { postMessage: jest.fn() };
    installMockServiceWorker(waiting);

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
    const waiting = { postMessage: jest.fn() };
    installMockServiceWorker(waiting);

    const error = new Error('Network request failed');
    await expect(loadWithRecovery(jest.fn().mockRejectedValue(error))).rejects.toBe(error);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('app.chunkLoadRecoveryAttempted')).toBeNull();
  });

  it('resolves normally when the factory succeeds', async () => {
    const mod = { default: () => null };
    await expect(loadWithRecovery(jest.fn().mockResolvedValue(mod))).resolves.toBe(mod);
  });

  it('rethrows a chunk-load error when there is no waiting worker to activate', async () => {
    installMockServiceWorker(null);
    const error = chunkLoadError();
    await expect(loadWithRecovery(jest.fn().mockRejectedValue(error))).rejects.toBe(error);
  });
});
