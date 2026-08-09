import { renderHook, act } from '@testing-library/react';
import { useServiceWorker } from '../useServiceWorker';

/**
 * The hook is the only thing the app talks to. Registration failing must never
 * break the app — the service worker is an enhancement, not a dependency.
 *
 * The hook no-ops outside production. NODE_ENV is captured and restored around
 * the whole suite rather than mutated at module scope: process.env is
 * process-wide and Jest reuses workers across test files, so a stray module-level
 * assignment can leak NODE_ENV into unrelated suites that run in the same worker.
 */

/** A minimal EventTarget-like double: records listeners and lets a test fire them. */
const fakeEmitter = () => {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    addEventListener: jest.fn((event: string, cb: () => void) => {
      (listeners[event] ||= []).push(cb);
    }),
    fire: (event: string) => {
      (listeners[event] || []).forEach((cb) => cb());
    },
  };
};

const makeWorker = () => ({
  state: 'installing' as string,
  postMessage: jest.fn(),
  ...fakeEmitter(),
});

const makeRegistration = (overrides: { waiting?: any; installing?: any } = {}) => ({
  waiting: overrides.waiting ?? null,
  installing: overrides.installing ?? null,
  ...fakeEmitter(),
});

/**
 * Swaps window.location for a double whose reload() is a spy, and restores the
 * original afterward. jsdom's real reload() throws "not implemented", and
 * jest.spyOn can't attach to it on every jsdom version, so this replaces the
 * whole object for the duration of one test.
 */
const withMockedReload = () => {
  const original = window.location;
  const reload = jest.fn();
  // @ts-expect-error - deliberately reassigning a normally-readonly global for the test
  delete window.location;
  window.location = { ...original, reload };
  return {
    reload,
    restore: () => {
      window.location = original;
    },
  };
};

describe('useServiceWorker', () => {
  const originalServiceWorker = (global as any).navigator.serviceWorker;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    (process.env as any).NODE_ENV = 'production';
  });

  afterAll(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: originalServiceWorker, configurable: true, writable: true
    });
    jest.restoreAllMocks();
  });

  it('never registers outside production', () => {
    const register = jest.fn().mockResolvedValue(makeRegistration());
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register, addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const restoreEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';
    try {
      renderHook(() => useServiceWorker());
      expect(register).not.toHaveBeenCalled();
    } finally {
      (process.env as any).NODE_ENV = restoreEnv;
    }
  });

  it('does not throw when the browser has no service worker support', () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: undefined, configurable: true, writable: true
    });
    expect(() => renderHook(() => useServiceWorker())).not.toThrow();
  });

  it('does not throw when registration rejects, and reports no update', async () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: jest.fn().mockRejectedValue(new Error('nope')), addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('registers the compiled worker script and reports no update when nothing is waiting', async () => {
    const register = jest.fn().mockResolvedValue(makeRegistration());
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register, addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(register).toHaveBeenCalledWith(expect.stringContaining('/service-worker.js'));
    expect(result.current.updateAvailable).toBe(false);
  });

  it('surfaces an update when a worker is already waiting from a previous visit', async () => {
    const waiting = { postMessage: jest.fn() };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(makeRegistration({ waiting })),
        addEventListener: jest.fn()
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(true);
  });

  it('flips updateAvailable when an installing worker finishes installing over an existing controller', async () => {
    const registration = makeRegistration();
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(registration),
        addEventListener: jest.fn(),
        controller: {} // a controller is already active: this is an update, not a first install
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(false);

    // Simulate the browser: a new worker starts installing...
    const installing = makeWorker();
    registration.installing = installing;
    act(() => { registration.fire('updatefound'); });

    // ...and finishes.
    installing.state = 'installed';
    act(() => { installing.fire('statechange'); });

    expect(result.current.updateAvailable).toBe(true);
  });

  it('surfaces an update when a worker is already installing by the time register() resolves (updatefound already fired)', async () => {
    // Simulates the browser's own navigation-triggered update check having
    // already kicked off an install before this hook's .then() callback ran:
    // registration.waiting is still null, but registration.installing is
    // already non-null — and no 'updatefound' event is coming, because it
    // already fired before anything here was listening for it.
    const installing = makeWorker();
    const registration = makeRegistration({ installing });
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(registration),
        addEventListener: jest.fn(),
        controller: {} // a controller is already active: this is an update
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(false);

    installing.state = 'installed';
    act(() => { installing.fire('statechange'); });

    expect(result.current.updateAvailable).toBe(true);
  });

  it('does not surface an update when the installing worker is a first install (no existing controller)', async () => {
    const registration = makeRegistration();
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(registration),
        addEventListener: jest.fn(),
        controller: null // nothing controls this page yet: first install, not an update
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });

    const installing = makeWorker();
    registration.installing = installing;
    act(() => { registration.fire('updatefound'); });

    installing.state = 'installed';
    act(() => { installing.fire('statechange'); });

    expect(result.current.updateAvailable).toBe(false);
  });

  it('applyUpdate tells the waiting worker to take over, and reloads only after the browser confirms the takeover', async () => {
    const waiting = { postMessage: jest.fn() };
    const swAddEventListener = jest.fn();
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(makeRegistration({ waiting })),
        addEventListener: swAddEventListener
      },
      configurable: true, writable: true
    });
    const { reload, restore } = withMockedReload();
    try {
      const { result } = renderHook(() => useServiceWorker());
      await act(async () => { await Promise.resolve(); });
      expect(result.current.updateAvailable).toBe(true);

      act(() => { result.current.applyUpdate(); });

      expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

      const controllerChangeCall = swAddEventListener.mock.calls.find(
        ([event]) => event === 'controllerchange'
      );
      expect(controllerChangeCall).toBeDefined();
      expect(controllerChangeCall![2]).toEqual({ once: true });

      // The bug this ordering guards against: reloading before the new worker
      // has actually taken control, which would drop whatever the member was
      // doing (mid-payment-form is the case the hook's own comment calls out).
      expect(reload).not.toHaveBeenCalled();

      act(() => { controllerChangeCall![1](); });
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it('applyUpdate reloads anyway if controllerchange never fires, instead of hanging forever', async () => {
    jest.useFakeTimers('modern');
    const waiting = { postMessage: jest.fn() };
    const swAddEventListener = jest.fn();
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(makeRegistration({ waiting })),
        addEventListener: swAddEventListener
      },
      configurable: true, writable: true
    });
    const { reload, restore } = withMockedReload();
    try {
      const { result } = renderHook(() => useServiceWorker());
      await act(async () => { await Promise.resolve(); });
      expect(result.current.updateAvailable).toBe(true);

      act(() => { result.current.applyUpdate(); });
      expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

      // Not yet: proves the assertion below is actually exercising the
      // timeout, not a fallback that fires immediately regardless of delay.
      expect(reload).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(7999); });
      expect(reload).not.toHaveBeenCalled();

      act(() => { jest.advanceTimersByTime(1); });
      expect(reload).toHaveBeenCalledTimes(1);

      // A controllerchange arriving late, after the timeout already resolved
      // things, must not trigger a second reload.
      const controllerChangeCall = swAddEventListener.mock.calls.find(
        ([event]) => event === 'controllerchange'
      );
      act(() => { controllerChangeCall![1](); });
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      restore();
      jest.useRealTimers();
    }
  });
});

import { trackEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('PWA analytics events', () => {
  beforeEach(() => {
    (trackEvent as jest.Mock).mockClear();
    sessionStorage.clear();
  });

  it('reports a standalone session exactly once per session', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    const { unmount } = renderHook(() => useServiceWorker());
    unmount();
    renderHook(() => useServiceWorker());

    const standalone = (trackEvent as jest.Mock).mock.calls
      .filter(([name]) => name === 'pwa_standalone_session');
    expect(standalone).toHaveLength(1);
  });

  it('does not report a standalone session in a browser tab', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;

    renderHook(() => useServiceWorker());

    expect((trackEvent as jest.Mock).mock.calls
      .filter(([name]) => name === 'pwa_standalone_session')).toHaveLength(0);
  });

  it('reports the outcome when a member dismisses the install offer', () => {
    const { result } = renderHook(() => useServiceWorker());
    act(() => { result.current.dismissInstall(); });

    expect(trackEvent).toHaveBeenCalledWith('pwa_install_prompt', { outcome: 'dismissed' });
  });
});
