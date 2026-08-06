import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ParishAnnouncements from '../ParishAnnouncements';
import { I18nProvider } from '../../i18n/I18nProvider';

const renderWithI18n = (ui: React.ReactElement) =>
  render(<I18nProvider>{ui}</I18nProvider>);

const announcement = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a1',
  title: 'Feast day liturgy at 6am',
  description: 'Divine Liturgy begins early this Sunday.',
  title_ti: null,
  description_ti: null,
  start_date: '2026-08-01',
  end_date: '2026-08-31',
  ...over,
});

const mockFetch = (body: unknown, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }) as unknown as typeof fetch;
};

describe('ParishAnnouncements', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('renders active announcements from the public feed', async () => {
    mockFetch({ success: true, data: [announcement()] });
    renderWithI18n(<ParishAnnouncements />);

    expect(await screen.findByText('Feast day liturgy at 6am')).toBeInTheDocument();
    expect(
      screen.getByText('Divine Liturgy begins early this Sunday.')
    ).toBeInTheDocument();
  });

  it('calls the endpoint without an Authorization header so visitors see it too', async () => {
    mockFetch({ success: true, data: [announcement()] });
    renderWithI18n(<ParishAnnouncements />);

    await screen.findByText('Feast day liturgy at 6am');
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain('/api/announcements/active');
    // A second argument would mean headers; there should be none.
    expect(call[1]).toBeUndefined();
  });

  it('renders nothing when there are no announcements', async () => {
    mockFetch({ success: true, data: [] });
    const { container } = renderWithI18n(<ParishAnnouncements />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('stays silent when the feed fails rather than showing an error on the home page', async () => {
    mockFetch({}, false);
    const { container } = renderWithI18n(<ParishAnnouncements />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to English when a Tigrigna translation is missing', async () => {
    localStorage.setItem('app.lang', 'ti');
    mockFetch({
      success: true,
      data: [announcement({ title: 'Parish meeting', title_ti: null })],
    });
    renderWithI18n(<ParishAnnouncements />);

    expect(await screen.findByText('Parish meeting')).toBeInTheDocument();
  });

  it('prefers the Tigrigna text when it exists', async () => {
    localStorage.setItem('app.lang', 'ti');
    mockFetch({
      success: true,
      data: [announcement({ title: 'Parish meeting', title_ti: 'ኣኼባ ማሕበር' })],
    });
    renderWithI18n(<ParishAnnouncements />);

    expect(await screen.findByText('ኣኼባ ማሕበር')).toBeInTheDocument();
    expect(screen.queryByText('Parish meeting')).not.toBeInTheDocument();
  });
});
