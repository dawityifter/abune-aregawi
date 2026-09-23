import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardCampaign, DashboardTimeline } from '../../../utils/pledgeDashboardApi';

interface CampaignHeaderProps {
  campaign: DashboardCampaign;
  timeline: DashboardTimeline;
  asOf: string;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-tsaeda-100 text-tsaeda-700',
  draft: 'bg-accent-100 text-accent-600',
  closed: 'bg-accent-200 text-accent-600'
};

/**
 * Identity and position in the window. No auto-refresh: figures shifting under
 * a board discussion is worse than figures a few minutes old, so the reader is
 * told when this was taken and refreshes when they choose. Spec section 11.
 */
const CampaignHeader: React.FC<CampaignHeaderProps> = ({
  campaign, timeline, asOf, onRefresh
}) => {
  const { t, language } = useLanguage();
  const title = language === 'ti' && campaign.name_ti ? campaign.name_ti : campaign.name;
  const asOfTime = new Date(asOf).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });
  // The API's status enum is not a display string. A status without a known
  // translation falls back to the raw value rather than hiding it.
  const statusLabel = t(`pledgeDashboard.header.status.${campaign.status}`) as string;
  const knownStatus = ['active', 'draft', 'closed'].includes(campaign.status);

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-h3 text-accent-700">{title}</h2>
          <span className={`rounded-full px-2 py-0.5 font-sans text-caption ${
            STATUS_STYLES[campaign.status] || STATUS_STYLES.draft
          }`}>
            {knownStatus ? statusLabel : campaign.status}
          </span>
        </div>
        {campaign.end_date && timeline.total_days != null && (
          <p data-testid="campaign-window" className="mt-1 font-sans text-caption text-accent-500">
            {campaign.start_date} – {campaign.end_date}
            {' · '}
            {t('pledgeDashboard.header.dayOf', {
              day: String(timeline.day), total: String(timeline.total_days)
            })}
            {timeline.days_remaining != null && (
              <> {' · '}{t('pledgeDashboard.header.remaining', {
                days: String(timeline.days_remaining)
              })}</>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span data-testid="as-of" className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.header.asOf', { time: asOfTime })}
        </span>
        <button
          onClick={onRefresh}
          className="rounded-md border border-accent-200 px-3 py-1.5 font-sans text-caption text-accent-600 hover:bg-accent-100"
        >
          {t('pledgeDashboard.header.refresh')}
        </button>
      </div>
    </header>
  );
};

export default CampaignHeader;
