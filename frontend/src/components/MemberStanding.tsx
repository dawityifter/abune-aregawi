import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useMemberDues } from '../hooks/useMemberDues';

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * What the dashboard should open with: the member's own situation.
 *
 * The dashboard previously opened with eight identical cards in seven
 * unrelated colours, every one of them a "View …" button — a menu of places to
 * go, presented as if it were information. None of it told the member what
 * they owe, what they have given, or where they stand.
 *
 * Colour here means state, not category: settled is verdigris, outstanding is
 * ochre. Neither is the brand red, which stays reserved for actions.
 */
const MemberStanding: React.FC<{ firstName?: string }> = ({ firstName }) => {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const { dues, loading } = useMemberDues(year);

  const settled = dues !== null && dues.outstandingDues <= 0;

  return (
    <section className="mb-6">
      <h1 className="font-serif text-3xl font-semibold text-accent-700">
        {firstName ? t('dashboard.greeting').replace('{name}', firstName) : t('dashboard.greetingNoName')}
      </h1>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card">
          <div className="text-caption font-semibold uppercase tracking-wider text-accent-500">
            {t('dashboard.standing.membership')}
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-24 rounded bg-accent-100" aria-hidden="true" />
          ) : dues === null ? (
            <p className="mt-1 text-accent-500">{t('dashboard.standing.unknown')}</p>
          ) : (
            <>
              <div
                className={`mt-1 font-serif text-h3 font-semibold ${
                  settled ? 'text-tsaeda-600' : 'text-secondary-700'
                }`}
              >
                {settled
                  ? t('dashboard.standing.paid')
                  : t('dashboard.standing.due').replace('{amount}', currency(dues.outstandingDues))}
              </div>
              <div className="mt-0.5 text-sm text-accent-500">
                {t('dashboard.standing.forYear').replace('{year}', String(dues.year))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="text-caption font-semibold uppercase tracking-wider text-accent-500">
            {t('dashboard.standing.givenThisYear').replace('{year}', String(year))}
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-24 rounded bg-accent-100" aria-hidden="true" />
          ) : dues === null ? (
            <p className="mt-1 text-accent-500">{t('dashboard.standing.unknown')}</p>
          ) : (
            <>
              <div className="mt-1 font-serif text-h3 font-semibold text-accent-700 tabular-nums">
                {currency(dues.duesCollected)}
              </div>
              <div className="mt-0.5 text-sm text-accent-500">
                <Link to="/dues" className="text-tsaeda-600 hover:underline">
                  {t('dashboard.standing.viewDues')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default MemberStanding;
