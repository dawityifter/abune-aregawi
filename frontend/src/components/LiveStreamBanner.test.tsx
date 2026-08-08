import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nProvider';
import LiveStreamBanner from './LiveStreamBanner';

const MAIN = 'UC_main_channel';
const SPIRITUAL = 'UC_spiritual_channel';

function idle() {
  return {
    main: { isLive: false, channelId: MAIN },
    spiritual: { isLive: false, channelId: SPIRITUAL }
  };
}

function mainLive(title = 'Divine Liturgy') {
  return {
    main: { isLive: true, channelId: MAIN, videoId: 'vid_live', title },
    spiritual: { isLive: false, channelId: SPIRITUAL }
  };
}

function mockFetchOnce(payload: unknown) {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => payload });
}

function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function renderBanner() {
  return render(
    <I18nProvider>
      <LiveStreamBanner />
    </I18nProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  mockFetchOnce(idle());
  setTabHidden(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('LiveStreamBanner', () => {
  it('stays hidden when neither channel is live', async () => {
    mockFetchOnce(idle());
    renderBanner();

    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText(/LIVE NOW/i)).not.toBeInTheDocument();
  });

  it('shows the banner when the main channel is live', async () => {
    mockFetchOnce(mainLive());
    renderBanner();

    await waitFor(() => expect(screen.getByText(/LIVE NOW/i)).toBeInTheDocument());
  });

  it('stops polling while the tab is hidden', async () => {
    mockFetchOnce(idle());
    renderBanner();
    await act(async () => { await Promise.resolve(); });

    const callsWhileVisible = (global.fetch as jest.Mock).mock.calls.length;
    setTabHidden(true);

    // Background tabs polling forever is what kept the API busy around the clock
    // even when nobody was watching the page.
    await act(async () => { jest.advanceTimersByTime(10 * 60 * 1000); });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsWhileVisible);
  });

  it('checks immediately when the tab becomes visible again', async () => {
    mockFetchOnce(idle());
    renderBanner();
    await act(async () => { await Promise.resolve(); });

    setTabHidden(true);
    await act(async () => { jest.advanceTimersByTime(10 * 60 * 1000); });
    const callsWhileHidden = (global.fetch as jest.Mock).mock.calls.length;

    mockFetchOnce(mainLive());
    await act(async () => { setTabHidden(false); await Promise.resolve(); });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsWhileHidden + 1);
    await waitFor(() => expect(screen.getByText(/LIVE NOW/i)).toBeInTheDocument());
  });

  it('keeps polling on the interval while the tab is visible', async () => {
    mockFetchOnce(idle());
    renderBanner();
    await act(async () => { await Promise.resolve(); });

    const initial = (global.fetch as jest.Mock).mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(2 * 60 * 1000); });

    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initial);
  });

  it('hides the banner again once the stream ends', async () => {
    mockFetchOnce(mainLive());
    renderBanner();
    await waitFor(() => expect(screen.getByText(/LIVE NOW/i)).toBeInTheDocument());

    mockFetchOnce(idle());
    await act(async () => { jest.advanceTimersByTime(2 * 60 * 1000); });

    await waitFor(() => expect(screen.queryByText(/LIVE NOW/i)).not.toBeInTheDocument());
  });

  it('stops polling after unmount', async () => {
    mockFetchOnce(idle());
    const { unmount } = renderBanner();
    await act(async () => { await Promise.resolve(); });

    unmount();
    const afterUnmount = (global.fetch as jest.Mock).mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(10 * 60 * 1000); });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(afterUnmount);
  });
});
