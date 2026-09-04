import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import AnalyticsDashboardLink from '../AnalyticsDashboardLink';

const SHARE_URL = 'https://analytics.example.church/share/abc123/Test%20Site';

const originalShareUrl = process.env.REACT_APP_UMAMI_SHARE_URL;

afterEach(() => {
  process.env.REACT_APP_UMAMI_SHARE_URL = originalShareUrl;
});

const renderLink = () => render(
  <I18nProvider>
    <LanguageProvider>
      <AnalyticsDashboardLink />
    </LanguageProvider>
  </I18nProvider>
);

describe('AnalyticsDashboardLink', () => {
  it('links to the configured analytics dashboard', () => {
    process.env.REACT_APP_UMAMI_SHARE_URL = SHARE_URL;
    renderLink();

    expect(screen.getByRole('link')).toHaveAttribute('href', SHARE_URL);
  });

  // The dashboard is a separate application; sending the admin there in place
  // would lose whatever they were partway through on this tab.
  it('opens the dashboard in a new tab', () => {
    process.env.REACT_APP_UMAMI_SHARE_URL = SHARE_URL;
    renderLink();

    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  });

  // Without noopener the opened page gets a handle on this one through
  // window.opener and can navigate it somewhere else.
  it('opens it without handing the new tab a reference back to this one', () => {
    process.env.REACT_APP_UMAMI_SHARE_URL = SHARE_URL;
    renderLink();

    const rel = screen.getByRole('link').getAttribute('rel') || '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  // Matches how the rest of the Umami integration behaves: absent configuration
  // means the feature is simply not there, not a card pointing nowhere.
  it('renders nothing when no dashboard URL is configured', () => {
    delete process.env.REACT_APP_UMAMI_SHARE_URL;
    const { container } = renderLink();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders nothing when the URL is configured but empty', () => {
    process.env.REACT_APP_UMAMI_SHARE_URL = '';
    const { container } = renderLink();

    expect(container).toBeEmptyDOMElement();
  });
});
