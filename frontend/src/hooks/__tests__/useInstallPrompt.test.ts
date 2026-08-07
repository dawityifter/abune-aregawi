import { renderHook, act } from '@testing-library/react';
import { useServiceWorker } from '../useServiceWorker';

/**
 * NODE_ENV is captured and restored around the whole suite rather than mutated
 * at module scope: process.env is process-wide and Jest reuses workers across
 * test files, so a stray module-level assignment can leak NODE_ENV into
 * unrelated suites that run in the same worker. Matches the pattern in
 * useServiceWorker.test.ts.
 */

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const setUserAgent = (ua: string) =>
  Object.defineProperty(global.navigator, 'userAgent', {
    value: ua, configurable: true, writable: true
  });

describe('install prompt', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    (process.env as any).NODE_ENV = 'production';
  });

  afterAll(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: jest.fn().mockResolvedValue({ addEventListener: jest.fn() }), addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    localStorage.clear();
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36');
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  const fireBeforeInstallPrompt = () => {
    const event: any = new Event('beforeinstallprompt');
    event.prompt = jest.fn().mockResolvedValue(undefined);
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
    return event;
  };

  it('cannot install until the browser offers the event', () => {
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.canInstall).toBe(false);
  });

  it('can install once beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useServiceWorker());
    act(() => { fireBeforeInstallPrompt(); });
    expect(result.current.canInstall).toBe(true);
  });

  it('shows the browser prompt when asked', () => {
    const { result } = renderHook(() => useServiceWorker());
    let event: any;
    act(() => { event = fireBeforeInstallPrompt(); });
    act(() => { result.current.promptInstall(); });
    expect(event.prompt).toHaveBeenCalled();
  });

  it('remembers a dismissal across mounts', () => {
    const first = renderHook(() => useServiceWorker());
    act(() => { fireBeforeInstallPrompt(); });
    act(() => { first.result.current.dismissInstall(); });
    expect(first.result.current.canInstall).toBe(false);

    const second = renderHook(() => useServiceWorker());
    act(() => { fireBeforeInstallPrompt(); });
    expect(second.result.current.canInstall).toBe(false);
  });

  it('detects iOS, which never fires beforeinstallprompt', () => {
    setUserAgent(IOS_UA);
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.isIos).toBe(true);
  });

  it('does not flag iOS when already running standalone', () => {
    setUserAgent(IOS_UA);
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: true });
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.isIos).toBe(false);
  });
});
