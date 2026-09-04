import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Sends an admin to the parish's own Umami dashboard for site traffic, next to
 * the in-app activity log covering member and financial actions.
 *
 * A link rather than an embed: the analytics host answers every route with
 * `frame-ancestors 'self'`, so an iframe served from this origin renders blank.
 * Allowing it would mean setting ALLOWED_FRAME_URLS on the analytics server,
 * which is not something this app can do or detect.
 *
 * REACT_APP_UMAMI_SHARE_URL is expected to be a Umami *share* link, which needs
 * no Umami account — otherwise every admin would land on a login screen. Read
 * at render rather than module scope so a test can set it per case.
 *
 * Absent or empty configuration renders nothing, matching the rest of the Umami
 * integration: a build without it behaves exactly as it did before.
 */
const AnalyticsDashboardLink: React.FC = () => {
  const { t } = useLanguage();
  const shareUrl = process.env.REACT_APP_UMAMI_SHARE_URL;

  if (!shareUrl) return null;

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">
          <i className="fas fa-chart-line mr-2 text-primary-600" aria-hidden="true"></i>
          {t('activityLog.analyticsTitle')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {t('activityLog.analyticsDescription')}
        </p>
      </div>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
      >
        {t('activityLog.analyticsLink')}
        <i className="fas fa-external-link-alt ml-2" aria-hidden="true"></i>
      </a>
    </div>
  );
};

export default AnalyticsDashboardLink;
