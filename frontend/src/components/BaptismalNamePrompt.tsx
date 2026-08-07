import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Asks a member for their baptismal name, once, if we do not have it.
 *
 * A survey of the real data found members had filled this in at 25.6% while
 * recording it for their children at 52.9% — the name is salient at a child's
 * baptism and a distant fact by the time an adult meets a registration form.
 * Nobody had asked them for it in years, so the fix is to ask.
 *
 * It is deliberately not a nag: dismissing it is permanent, there is no badge
 * or counter, and it never reappears once answered or declined.
 */

const DISMISS_KEY = 'baptismalNamePrompt.dismissed';

const BaptismalNamePrompt: React.FC = () => {
  const { user, currentUser, firebaseUser } = useAuth();
  const { t, lang } = useI18n();

  const member = (user as any)?.data?.member || user;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  );
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyHasName = Boolean(
    member?.baptismName || member?.baptism_name
  );

  // Nothing to ask for, nothing to ask of a half-registered session.
  if (!member || member._temp || alreadyHasName || dismissed || saved) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const uid = currentUser?.uid;
      const token = await firebaseUser?.getIdToken();
      const params = new URLSearchParams();
      if (currentUser?.email) params.append('email', currentUser.email);
      if (currentUser?.phoneNumber) params.append('phone', currentUser.phoneNumber);

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          // Only this field. The handler drops undefined and null keys before
          // updating, so nothing else on the record is touched.
          body: JSON.stringify({ baptismName: trimmed })
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
    } catch (err) {
      setError(t('baptismalName.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={`bg-white rounded-lg shadow border border-amber-200 p-5 mb-6 ${lang === 'ti' ? 'text-tigrigna' : ''}`}
      aria-labelledby="baptismal-name-heading"
    >
      <h2 id="baptismal-name-heading" className="text-base font-semibold text-primary-800">
        {t('baptismalName.title')}
      </h2>
      <p className="mt-1.5 text-sm text-gray-700 max-w-prose">
        {t('baptismalName.why')}
      </p>

      <form onSubmit={save} className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-start">
        <div className="flex-grow">
          <label htmlFor="baptismal-name-input" className="sr-only">
            {t('baptismalName.label')}
          </label>
          <input
            id="baptismal-name-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('baptismalName.placeholder')}
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !value.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {saving ? t('baptismalName.saving') : t('baptismalName.save')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 whitespace-nowrap"
          >
            {t('baptismalName.notNow')}
          </button>
        </div>
      </form>
    </section>
  );
};

export default BaptismalNamePrompt;
