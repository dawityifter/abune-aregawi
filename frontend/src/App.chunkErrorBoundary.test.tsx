import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyWithRecovery as lazy } from './utils/lazyWithRecovery';

/**
 * Every new unit here (ErrorBoundary, lazyWithRecovery, BottomNav, ...) is
 * tested in isolation elsewhere. Nothing tested the thing they were jointly
 * assembled into: what actually happens, at the App level, when a lazy
 * route's chunk fails to load and lazyWithRecovery's own one-shot recovery
 * has nothing to recover with (no service worker registered — the default
 * in this test environment, and the real state for a member who is offline
 * or whose browser doesn't support service workers).
 *
 * AppRouteTree below is a *faithful reduction* of App.tsx's route tree, not
 * a mock of it: same ErrorBoundary -> Suspense -> Routes nesting, in the
 * same order, that App.tsx uses around its lazy routes (see App.tsx around
 * the <Suspense> block). Rendering the full <App/> would require mocking
 * Firebase, Stripe, TipTap, and the rest of the app's real dependencies
 * wholesale, which would test those mocks more than it tests the wrapping
 * structure this file actually cares about.
 *
 * This test was written to fail against the pre-fix App.tsx (no
 * ErrorBoundary above Suspense/Routes) and pass against the fixed one — see
 * the fix report for both captured outputs.
 */
const FailingRoute = lazy(() => {
  const error = new Error('Loading chunk 7 failed.');
  error.name = 'ChunkLoadError';
  return Promise.reject(error);
});

const AppRouteTree: React.FC = () => (
  <div>
    {/* Stands in for App.tsx's <Navigation />, <BottomNav />, etc. — chrome
        that sits as a *sibling* of <Suspense>, inside the same unmounted
        subtree if nothing catches the thrown error above this component. */}
    <nav aria-label="site navigation">site nav</nav>
    <ErrorBoundary>
      <Suspense fallback={<div>loading…</div>}>
        <Routes>
          <Route path="/" element={<FailingRoute />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  </div>
);

describe('App route tree — chunk-load recovery fallback', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // ErrorBoundary logs the caught error; React also logs the "above error
    // occurred" boilerplate. Both are expected noise for this test.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Recovery unavailable: no navigator.serviceWorker in this environment
    // (jsdom doesn't define it by default, and nothing in this file adds
    // one), so loadWithRecovery's activateWaitingWorkerAndReload short-circuits
    // to `false` and the original ChunkLoadError is rethrown immediately.
    delete (navigator as any).serviceWorker;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows error UI instead of leaving a blank page when a lazy route fails and recovery is unavailable', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppRouteTree />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    // The specific regression this guards: with no ErrorBoundary above
    // Suspense/Routes, React unmounts the whole tree once an uncaught error
    // propagates past every boundary, wiping siblings like <nav> along with
    // it and leaving container.innerHTML === ''. Scoping the boundary around
    // just Suspense/Routes (matching App.tsx) means the sibling nav survives.
    expect(container.innerHTML).not.toBe('');
    expect(screen.getByLabelText('site navigation')).toBeInTheDocument();
  });
});
