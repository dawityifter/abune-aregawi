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

const makeRegistration = () => {
  const waiting = { postMessage: jest.fn() };
  return {
    waiting: null as any,
    installing: null as any,
    addEventListener: jest.fn(),
    _waiting: waiting
  };
};

describe('useServiceWorker', () => {
  const original = (global as any).navigator.serviceWorker;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    (process.env as any).NODE_ENV = 'production';
  });

  afterAll(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: original, configurable: true, writable: true
    });
    jest.restoreAllMocks();
  });

  it('reports no update available before anything registers', () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: jest.fn().mockResolvedValue(makeRegistration()), addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.updateAvailable).toBe(false);
  });

  it('does not throw when the browser has no service worker support', () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: undefined, configurable: true, writable: true
    });
    expect(() => renderHook(() => useServiceWorker())).not.toThrow();
  });

  it('does not throw when registration rejects', async () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: jest.fn().mockRejectedValue(new Error('nope')), addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('surfaces an update when a worker is already waiting', async () => {
    const waiting = { postMessage: jest.fn() };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue({ waiting, addEventListener: jest.fn() }),
        addEventListener: jest.fn()
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(true);
  });

  it('tells the waiting worker to take over when the update is applied', async () => {
    const waiting = { postMessage: jest.fn() };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue({ waiting, addEventListener: jest.fn() }),
        addEventListener: jest.fn()
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.applyUpdate(); });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
