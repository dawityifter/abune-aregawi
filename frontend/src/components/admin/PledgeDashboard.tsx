import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useActiveCampaign } from '../../hooks/useActiveCampaign';
import {
  DashboardSnapshot, Comparison, MonthlySeries,
  fetchDashboard, fetchMonthly, fetchComparison, formatFigure
} from '../../utils/pledgeDashboardApi';
import { AdminCampaign, fetchAllCampaigns } from '../../utils/pledgeCampaignApi';
import CampaignHeader from './dashboard/CampaignHeader';
import MoneyBar from './dashboard/MoneyBar';
import KpiCard from './dashboard/KpiCard';
import DistributionBars from './dashboard/DistributionBars';
import AttentionPanel from './dashboard/AttentionPanel';
import MonthlyCollections from './dashboard/MonthlyCollections';
import YearOverYear from './dashboard/YearOverYear';

interface PledgeDashboardProps {
  /** Raises a chosen status or attention filter so the donor table can scope to it. */
  onFilterChange: (filter: string | null) => void;
  /** The filter the donor table is currently on, marked in the band. */
  activeFilter?: string | null;
}

const PledgeDashboard: React.FC<PledgeDashboardProps> = ({ onFilterChange, activeFilter = null }) => {
  const { t } = useLanguage();
  const { campaign } = useActiveCampaign();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Both sections are collapsed by default and both endpoints are tier-3
  // only (Plan 2), so most callers who open them will draw a 403. `undefined`
  // means "not fetched yet"; `null` means "fetched and withheld" — the same
  // fetched-vs-withheld distinction the fetchers themselves use.
  const [monthly, setMonthly] = useState<MonthlySeries | null | undefined>(undefined);
  const [comparison, setComparison] = useState<Comparison | null | undefined>(undefined);
  // undefined: not looked up yet. null: looked up, no earlier drive exists.
  // number: the id of the earlier drive to compare against.
  const [priorCampaignId, setPriorCampaignId] = useState<number | null | undefined>(undefined);
  const [openSection, setOpenSection] = useState<'monthly' | 'yoy' | null>(null);
  // A 500 (or any non-403 failure) must not be cached as a loaded value —
  // `monthly`/`comparison` stay `undefined` so the section retries on the
  // next open — but it also must not sit on the loading note forever with an
  // unhandled rejection. These flags carry "the last attempt failed" so the
  // section can say so and offer a retry via close/reopen.
  const [monthlyError, setMonthlyError] = useState(false);
  const [comparisonError, setComparisonError] = useState(false);

  // Keyed on the id rather than the campaign object: useActiveCampaign (and,
  // in tests, a mock of it) may hand back a new object identity on every
  // render even when the campaign itself hasn't changed. Keying the effect on
  // the object would refetch — and in a mock that returns a fresh object each
  // call, loop — forever.
  const campaignId = campaign?.id;

  const load = useCallback(async () => {
    if (!campaignId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchDashboard(campaignId));
    } catch (err: any) {
      // The server's message is for the developer console, not the page: it
      // is English-only and can be technical. The page says it in the
      // reader's language (see the error box below).
      console.error('Pledge dashboard failed to load:', err?.message);
      setError(err?.message || 'Failed to load the dashboard');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  if (!campaign) return null;
  if (loading && !snapshot) {
    return <div className="py-8 text-center font-sans text-caption text-accent-500">…</div>;
  }

  // A failed load shows nothing rather than zeroes. Rendering an empty band
  // would state that the drive has collected nothing, which is a different and
  // much worse claim than "this did not load".
  if (error && !snapshot) {
    return (
      <div data-testid="dashboard-error"
        className="rounded-md border border-primary-200 bg-primary-50 p-4 font-sans text-caption text-primary-800">
        {t('pledgeDashboard.loadFailed')}
      </div>
    );
  }
  if (!snapshot) return null;

  const { money, participation, timeline } = snapshot;

  // At goal the run-rate is 0 — "needs $0/day" is true but reads as a
  // glitch, so it says the goal is reached instead.
  const runRateLine = money.required_run_rate === 0
    ? t('pledgeDashboard.kpi.goalReached')
    : money.required_run_rate != null && timeline.days_remaining != null
      ? t('pledgeDashboard.kpi.runRate', {
          amount: formatFigure(money.required_run_rate, 'money'),
          days: formatFigure(timeline.days_remaining, 'count')
        })
      : undefined;
  // Spec section 11 rule 2: "Received" is defined on the card itself — as
  // the only secondary line, or beneath the run-rate line when there is one.
  const receivedDefinition = t('pledgeDashboard.kpi.receivedDefinition');

  // A withheld (null) figure keeps its line and shows "—", as AttentionPanel
  // does: dropping the line would let a protected figure read as "none".
  const shown = (value: number | null) => value === null || value > 0;

  // When family_id is not populated, every member reads as their own household
  // and the figure is a member count wearing a household label. Say "members".
  const participationLabel = participation.family_id_populated
    ? t('pledgeDashboard.kpi.participationHouseholds')
    : t('pledgeDashboard.kpi.participationMembers');

  // Fetched on first open rather than with the band: both are collapsed by
  // default, and for a tier-2 role both return 403. `undefined` means not yet
  // fetched; `null` means fetched and withheld. `fetchMonthly` rejects on a
  // non-403 failure (`readError` throws) — that must not be left unhandled,
  // and must not be cached as `monthly` staying `undefined` forever with no
  // sign anything went wrong, so it's caught here and flagged separately.
  const openMonthly = async () => {
    setOpenSection(openSection === 'monthly' ? null : 'monthly');
    if (monthly === undefined && campaignId) {
      setMonthlyError(false);
      try {
        setMonthly(await fetchMonthly(campaignId));
      } catch {
        // Leave `monthly` at `undefined` so the next open retries instead of
        // treating this failure as a loaded (and withheld) value.
        setMonthlyError(true);
      }
    }
  };

  // The prior drive is whichever campaign has the latest start_date strictly
  // before this one's — looked up lazily, once, the first time this section
  // opens. If none exists there is nothing to fetch a comparison against.
  // Both `fetchAllCampaigns` and `fetchComparison` reject on a non-403
  // failure; caught here for the same reason as `openMonthly`, and without
  // caching a failed `fetchComparison` behind an already-resolved
  // `priorCampaignId` — otherwise a retry would skip straight past it.
  const openComparison = async () => {
    setOpenSection(openSection === 'yoy' ? null : 'yoy');
    if (!campaignId || priorCampaignId === null) return;
    // Already have a comparison (or a withheld 403) for the known prior drive.
    if (priorCampaignId !== undefined && comparison !== undefined) return;

    setComparisonError(false);
    try {
      let prior: number | null = priorCampaignId ?? null;
      if (priorCampaignId === undefined) {
        const campaigns = await fetchAllCampaigns();
        const found = campaigns
          .filter((c) => c.start_date < snapshot.campaign.start_date)
          .reduce<AdminCampaign | null>(
            (latest, c) => (!latest || c.start_date > latest.start_date ? c : latest), null
          );
        prior = found ? found.id : null;
        setPriorCampaignId(prior);
      }
      if (prior !== null) setComparison(await fetchComparison(campaignId, prior));
    } catch {
      setComparisonError(true);
    }
  };

  const loadingNote = <p className="font-sans text-caption text-accent-500">…</p>;

  return (
    <section className="space-y-4">
      <CampaignHeader
        campaign={snapshot.campaign}
        timeline={timeline}
        asOf={snapshot.as_of}
        onRefresh={load}
      />

      {/* A refresh can fail after a snapshot has already loaded — load()
          keeps the last-good snapshot on screen rather than clearing it, so
          the failure must be said out loud here or the treasurer would just
          see stale numbers with no sign anything went wrong. Clears itself on
          the next successful load, since load() resets error to null first. */}
      {error && (
        <p data-testid="dashboard-refresh-error"
          className="font-sans text-caption text-primary-700">
          {t('pledgeDashboard.refreshFailed')}
        </p>
      )}

      <MoneyBar money={money} timeline={timeline} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('pledgeDashboard.kpi.received')}
          value={formatFigure(money.collected, 'money')}
          secondary={runRateLine ?? receivedDefinition}
          note={runRateLine ? receivedDefinition : undefined}
        />
        <KpiCard
          label={t('pledgeDashboard.kpi.owed')}
          value={formatFigure(money.outstanding_owed, 'money')}
          secondary={shown(money.overpaid)
            ? t('pledgeDashboard.kpi.overpaid', { amount: formatFigure(money.overpaid, 'money') })
            : undefined}
        />
        <div data-testid="kpi-participation">
          <KpiCard
            label={participationLabel}
            value={t('pledgeDashboard.kpi.participationValue', {
              count: formatFigure(participation.households, 'count'),
              total: formatFigure(participation.active_households, 'count'),
              rate: formatFigure(participation.rate, 'percent')
            })}
            secondary={shown(participation.anonymous_pledges)
              ? t('pledgeDashboard.kpi.anonymous', {
                  count: formatFigure(participation.anonymous_pledges, 'count')
                })
              : undefined}
          />
        </div>
        <KpiCard
          label={t('pledgeDashboard.kpi.fulfillment')}
          value={formatFigure(money.fulfillment_rate, 'percent')}
          secondary={t('pledgeDashboard.kpi.fulfillmentNote')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <h3 className="mb-3 font-serif text-h4 text-accent-700">
            {t('pledgeDashboard.breakdown.title')}
          </h3>
          <DistributionBars
            rows={snapshot.breakdown}
            pledgedTotal={money.pledged}
            activeStatus={activeFilter}
            onSelectStatus={onFilterChange}
          />
        </div>
        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <h3 className="mb-3 font-serif text-h4 text-accent-700">
            {t('pledgeDashboard.attention.title')}
          </h3>
          <AttentionPanel
            attention={snapshot.attention}
            activeFilter={activeFilter}
            onSelect={onFilterChange}
          />
        </div>
      </div>

      {/* Below-the-fold and collapsed by default: both endpoints are tier-3
          only, so most callers who expand these will see an explained
          restriction rather than a chart. Fetched lazily, on first open. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <button
            type="button"
            data-testid="monthly-toggle"
            aria-expanded={openSection === 'monthly'}
            onClick={openMonthly}
            className="flex w-full items-center justify-between font-serif text-h4 text-accent-700"
          >
            <span>{t('pledgeDashboard.monthly.title')}</span>
            <span aria-hidden="true">{openSection === 'monthly' ? '−' : '+'}</span>
          </button>
          {openSection === 'monthly' && (
            <div className="mt-3">
              {monthlyError
                ? (
                  <p data-testid="monthly-error" className="font-sans text-caption text-primary-700">
                    {t('pledgeDashboard.sectionFailed')}
                  </p>
                )
                : monthly === undefined ? loadingNote : <MonthlyCollections series={monthly} />}
            </div>
          )}
        </div>

        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <button
            type="button"
            data-testid="yoy-toggle"
            aria-expanded={openSection === 'yoy'}
            onClick={openComparison}
            className="flex w-full items-center justify-between font-serif text-h4 text-accent-700"
          >
            <span>{t('pledgeDashboard.yoy.title')}</span>
            <span aria-hidden="true">{openSection === 'yoy' ? '−' : '+'}</span>
          </button>
          {openSection === 'yoy' && (
            <div className="mt-3">
              {comparisonError
                ? (
                  <p data-testid="yoy-error" className="font-sans text-caption text-primary-700">
                    {t('pledgeDashboard.sectionFailed')}
                  </p>
                )
                : priorCampaignId === undefined
                  ? loadingNote
                  : priorCampaignId === null
                    ? (
                      <p data-testid="yoy-no-prior" className="font-sans text-caption text-accent-500">
                        {t('pledgeDashboard.yoy.noPrior')}
                      </p>
                    )
                    : comparison === undefined
                      ? loadingNote
                      : <YearOverYear comparison={comparison} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PledgeDashboard;
