import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../i18n/I18nProvider';
import App from '../App';

/**
 * The pledge route is singular (/pledge), which makes /pledges an easy guess to
 * get wrong — and App.tsx has no catch-all route, so an unmatched path renders a
 * blank page with no error to explain it. This asserts the plural URL lands on
 * the real page.
 *
 * Renders the real App rather than a hand-built route table: App owns its own
 * BrowserRouter, and a test that re-declares the routes would pass even if the
 * redirect were deleted from App.tsx.
 */

describe('/pledges', () => {
  it('redirects to the /pledge page', async () => {
    window.history.pushState({}, '', '/pledges');

    // index.tsx wraps App in I18nProvider; App's own LanguageProvider needs it.
    render(<I18nProvider><App /></I18nProvider>);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/pledge');
    });
  });

  it('leaves the canonical /pledge path alone', async () => {
    window.history.pushState({}, '', '/pledge');

    // index.tsx wraps App in I18nProvider; App's own LanguageProvider needs it.
    render(<I18nProvider><App /></I18nProvider>);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/pledge');
    });
  });
});
