import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { useI18n } from '../i18n/I18nProvider';

/**
 * The parish already stores announcements — bilingual, date-bounded, editable
 * from the admin panel — but until now only the lobby TV rendered them. This
 * surfaces the same feed to the people it was written for.
 *
 * `/api/announcements/active` is public, so this renders for signed-out
 * visitors too.
 */

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  title_ti: string | null;
  description_ti: string | null;
  start_date: string;
  end_date: string;
}

type Variant = 'home' | 'dashboard';

const formatEndDate = (iso: string, lang: string) => {
  // Dates arrive as DATEONLY strings; parsing as local midnight avoids the
  // off-by-one a UTC parse produces west of Greenwich.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'ti' ? 'am-ET' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const ParishAnnouncements: React.FC<{ variant?: Variant }> = ({ variant = 'home' }) => {
  const { t, lang } = useI18n();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

    fetch(`${apiUrl}/api/announcements/active`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (!active) return;
        setAnnouncements(Array.isArray(body?.data) ? body.data : []);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  // Choose the member's language, falling back to English rather than showing
  // an empty card when a translation has not been written yet.
  const pick = (en: string | null, ti: string | null) =>
    (lang === 'ti' ? ti || en : en) || '';

  /**
   * The two description fields are not the same format. English is authored in
   * the TipTap editor and arrives as HTML; Tigrigna is a plain textarea and
   * arrives as text. So the rendering depends on which field was actually used,
   * not on the display language — a Tigrigna reader falling back to English
   * still needs the HTML path.
   */
  const describe = (a: Announcement): { body: string; isHtml: boolean } | null => {
    if (lang === 'ti' && a.description_ti) {
      return { body: a.description_ti, isHtml: false };
    }
    if (a.description) return { body: a.description, isHtml: true };
    if (a.description_ti) return { body: a.description_ti, isHtml: false };
    return null;
  };

  // A parish with nothing to announce should show nothing at all, not an empty
  // heading — and a fetch failure is not worth interrupting the page for.
  if (!loaded || failed || announcements.length === 0) return null;

  const isDashboard = variant === 'dashboard';

  return (
    <section
      className={isDashboard ? 'mb-6' : 'py-12'}
      aria-labelledby="parish-announcements-heading"
    >
      <div className={isDashboard ? '' : 'container mx-auto px-4'}>
        <div className={isDashboard ? '' : 'max-w-6xl mx-auto'}>
          <h2
            id="parish-announcements-heading"
            className={
              isDashboard
                ? 'text-lg font-medium text-gray-900 mb-3'
                : 'section-title'
            }
          >
            {isDashboard ? t('parishNews.dashboardTitle') : t('parishNews.title')}
          </h2>

          <ul className="grid gap-4 md:grid-cols-2 list-none p-0 m-0">
            {announcements.map((a) => {
              const title = pick(a.title, a.title_ti);
              const described = describe(a);
              return (
                <li
                  key={a.id}
                  className="bg-white rounded-lg shadow border border-gray-200 p-5"
                >
                  <h3 className="text-base font-semibold text-primary-800">
                    {title}
                  </h3>
                  {described && (described.isHtml ? (
                    // Sanitized because this is admin-authored rich text on a
                    // public page: the editor only emits safe markup, but the
                    // stored value is not something this component should trust
                    // on that basis alone.
                    <div
                      className="mt-2 text-sm text-gray-700 prose prose-sm max-w-none prose-p:my-2 prose-strong:text-gray-900"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(described.body) }}
                    />
                  ) : (
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">
                      {described.body}
                    </p>
                  ))}
                  <p className="mt-3 text-xs text-gray-500">
                    {t('parishNews.through')} {formatEndDate(a.end_date, lang)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default ParishAnnouncements;
