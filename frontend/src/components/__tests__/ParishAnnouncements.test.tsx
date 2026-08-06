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

describe('rich text from the admin editor', () => {
  // The composer uses TipTap for the English description, so what arrives is
  // HTML. It was previously rendered as plain text and members saw the tags.
  const RICH =
    '<p>We joyfully invite all faithful members to observe the ' +
    '<strong>Fast of the Assumption</strong>, Nehase 1–15.</p>' +
    '<p>May God bless you and your family.</p>';

  it('renders HTML as formatted text, not as visible tags', async () => {
    mockFetch({ success: true, data: [announcement({ description: RICH })] });
    renderWithI18n(<ParishAnnouncements />);

    expect(await screen.findByText(/We joyfully invite all faithful members/)).toBeInTheDocument();
    // The markup must not appear literally anywhere on the page.
    expect(document.body.textContent).not.toContain('<p>');
    expect(document.body.textContent).not.toContain('<strong>');
  });

  it('preserves the emphasis the author applied', async () => {
    mockFetch({ success: true, data: [announcement({ description: RICH })] });
    const { container } = renderWithI18n(<ParishAnnouncements />);

    await screen.findByText(/We joyfully invite/);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe('Fast of the Assumption');
    expect(container.querySelectorAll('p').length).toBeGreaterThanOrEqual(2);
  });

  it('strips scripts and event handlers before rendering', async () => {
    mockFetch({
      success: true,
      data: [announcement({
        description:
          '<p>Safe text</p><script>window.__pwned = true;</script>' +
          '<img src=x onerror="window.__pwned = true">'
      })]
    });
    const { container } = renderWithI18n(<ParishAnnouncements />);

    await screen.findByText('Safe text');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('treats the Tigrigna description as plain text, since it comes from a textarea', async () => {
    localStorage.setItem('app.lang', 'ti');
    mockFetch({
      success: true,
      data: [announcement({
        description: '<p>English rich text</p>',
        // A textarea value that happens to contain angle brackets must be shown
        // literally rather than interpreted as markup.
        description_ti: 'ጾመ ፍልሰታ <ካብ ነሓሰ 1-15>'
      })]
    });
    const { container } = renderWithI18n(<ParishAnnouncements />);

    expect(await screen.findByText(/ጾመ ፍልሰታ <ካብ ነሓሰ 1-15>/)).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeNull();
  });

  it('uses the HTML path when a Tigrigna reader falls back to English', async () => {
    localStorage.setItem('app.lang', 'ti');
    mockFetch({
      success: true,
      data: [announcement({ description: RICH, description_ti: null })]
    });
    const { container } = renderWithI18n(<ParishAnnouncements />);

    await screen.findByText(/We joyfully invite/);
    expect(container.querySelector('strong')).not.toBeNull();
  });
});
