import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  fetchAllCampaigns, createCampaign, updateCampaign,
  AdminCampaign, CampaignInput
} from '../../utils/pledgeCampaignApi';
import CampaignDonors from './CampaignDonors';

/** Admins should never have to invent a slug; the name gives a good one. */
const slugify = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const emptyForm = {
  name: '', name_ti: '', description: '', description_ti: '',
  start_date: '', end_date: '', goal_amount: ''
};

interface FundraisingCampaignsProps {
  /** Reading campaigns is open to finance/leadership roles; creating, editing
      and activating stay admin-only, mirroring the API's viewRoles/adminRoles
      split. Defaults to false so the component fails closed. */
  canManage?: boolean;
}

const FundraisingCampaigns: React.FC<FundraisingCampaignsProps> = ({ canManage = false }) => {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // null = the form is creating; an id = it is editing that campaign.
  const [editingId, setEditingId] = useState<number | null>(null);
  // Which campaign's donor list is expanded, if any.
  const [donorsForId, setDonorsForId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCampaigns(await fetchAllCampaigns());
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (form.end_date && form.end_date < form.start_date) {
      setError(t('fundraising.endBeforeStart'));
      return;
    }

    const input: CampaignInput = {
      slug: slugify(form.name),
      name: form.name,
      name_ti: form.name_ti || null,
      description: form.description || null,
      description_ti: form.description_ti || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      goal_amount: form.goal_amount ? parseFloat(form.goal_amount) : null,
      // Routes drive money to its own GL code instead of the INC999 fallback.
      default_payment_type: 'pledge_drive'
    };

    try {
      setError(null);
      if (editingId !== null) {
        // Deliberately no `status` in the payload: editing a running drive's
        // goal must not silently deactivate it. Status changes go through the
        // Activate / Close buttons, which is also where the overlap check
        // gives a useful message.
        await updateCampaign(editingId, input);
      } else {
        await createCampaign({ ...input, status: 'draft' });
      }
      closeForm();
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to save the campaign');
    }
  };

  const closeForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (campaign: AdminCampaign) => {
    setForm({
      name: campaign.name,
      name_ti: campaign.name_ti || '',
      description: campaign.description || '',
      description_ti: campaign.description_ti || '',
      start_date: campaign.start_date,
      end_date: campaign.end_date || '',
      // DECIMAL arrives as a string like "50000.00"; the number input needs
      // a bare number or it renders empty.
      goal_amount: campaign.goal_amount ? String(parseFloat(campaign.goal_amount)) : ''
    });
    setEditingId(campaign.id);
    setShowForm(true);
    setError(null);
  };

  // A campaign is only *live* when it is active AND today is inside its window,
  // so reactivating a finished drive would flip the status here and change
  // nothing members can see. The API refuses it (CAMPAIGN_WINDOW_PASSED) and is
  // the authority; this only avoids offering an action that cannot work. The
  // comparison is the browser's day against an ISO date, so it can differ from
  // the church timezone by hours at a boundary — the server settles it.
  const windowHasPassed = (campaign: AdminCampaign) => {
    if (!campaign.end_date) return false;
    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
    return campaign.end_date < localToday;
  };

  // The 409 body names the conflicting drive, so show the server's message
  // verbatim rather than a generic failure.
  const handleStatus = async (campaign: AdminCampaign, status: 'active' | 'closed') => {
    try {
      setError(null);
      await updateCampaign(campaign.id, { status });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update the campaign');
    }
  };

  // campaign_totals returns DECIMALs as strings; format only after parsing.
  const money = (value: string | null | undefined) =>
    value === null || value === undefined
      ? null
      : new Intl.NumberFormat('en-US', {
          style: 'currency', currency: 'USD', maximumFractionDigits: 0
        }).format(parseFloat(value));

  const field = (key: keyof typeof emptyForm, label: string, type = 'text') => (
    <div>
      <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-md border-gray-300 shadow-sm"
      />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('fundraising.heading')}</h2>
        {canManage && (
          <button
            onClick={() => (showForm ? closeForm() : (setForm(emptyForm), setEditingId(null), setShowForm(true)))}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            {t('fundraising.newCampaign')}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {showForm && canManage && (
        <div className="mb-8 bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('name', t('fundraising.name'))}
          {field('name_ti', t('fundraising.nameTi'))}
          {field('description', t('fundraising.description'))}
          {field('description_ti', t('fundraising.descriptionTi'))}
          {field('start_date', t('fundraising.startDate'), 'date')}
          {field('end_date', t('fundraising.endDate'), 'date')}
          {field('goal_amount', t('fundraising.goalAmount'), 'number')}
          <div className="md:col-span-2 flex gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              {t('fundraising.save')}
            </button>
            <button
              onClick={() => { closeForm(); setError(null); }}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              {t('fundraising.cancel')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">…</div>
      ) : campaigns.length === 0 ? (
        <div className="py-8 text-center text-gray-500">{t('fundraising.noCampaigns')}</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            // A pledge can be over-fulfilled (a payment lands on it in full even
            // when it overshoots), which drives this negative — never show that
            // raw, or a treasurer reads it as a bug rather than generosity.
            const outstandingValue = campaign.totals ? parseFloat(campaign.totals.outstanding || '0') : 0;
            return (
            <div key={campaign.id} className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{campaign.name}</div>
                <div className="text-sm text-gray-600">
                  {campaign.start_date} – {campaign.end_date || '—'}
                </div>
                <div className="text-sm text-gray-500 capitalize">{campaign.status}</div>
              </div>
              <div className="text-right">
                {campaign.totals ? (
                  <div className="text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1 justify-end">
                    <span>{t('fundraising.pledged')}: <strong>{money(campaign.totals.total_pledged) ?? '$0'}</strong></span>
                    <span>{t('fundraising.collected')}: <strong>{money(campaign.totals.total_collected) ?? '$0'}</strong></span>
                    <span>{t('fundraising.outstanding')}: <strong>
                      {outstandingValue < 0 ? (
                        <>
                          {money('0')}{' '}
                          <span className="text-xs text-gray-500 font-normal">
                            {t('fundraising.overBy', { amount: money(String(-outstandingValue)) })}
                          </span>
                        </>
                      ) : (money(campaign.totals.outstanding) ?? '$0')}
                    </strong></span>
                    <span>{t('fundraising.donors')}: <strong>{campaign.totals.donor_count ?? 0}</strong></span>
                    {campaign.goal_amount && (
                      <span>
                        <strong>{campaign.totals.percent_to_goal ?? '0'}%</strong> {t('fundraising.toGoal')}
                        {' '}({money(campaign.goal_amount)})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">{t('fundraising.noTotals')}</div>
                )}
                <div className="mt-2 flex gap-2 justify-end">
                  <button
                    onClick={() => setDonorsForId(donorsForId === campaign.id ? null : campaign.id)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    {t('fundraising.viewDonors')}
                  </button>
                  {canManage && (
                  <button
                    onClick={() => startEdit(campaign)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    {t('fundraising.edit')}
                  </button>
                  )}
                  {canManage && campaign.status === 'draft' && (
                    <button
                      onClick={() => handleStatus(campaign, 'active')}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      {t('fundraising.activate')}
                    </button>
                  )}
                  {canManage && campaign.status === 'closed' && !windowHasPassed(campaign) && (
                    <button
                      onClick={() => {
                        if (window.confirm(t('fundraising.reactivateWarning'))) {
                          handleStatus(campaign, 'active');
                        }
                      }}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      {t('fundraising.reactivate')}
                    </button>
                  )}
                  {canManage && campaign.status === 'closed' && windowHasPassed(campaign) && (
                    <p className="text-sm text-gray-500 max-w-xs">
                      {t('fundraising.windowPassedHint')}
                    </p>
                  )}
                  {canManage && campaign.status === 'active' && (
                    <button
                      onClick={() => {
                        if (window.confirm(t('fundraising.closeWarning'))) {
                          handleStatus(campaign, 'closed');
                        }
                      }}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md"
                    >
                      {t('fundraising.close')}
                    </button>
                  )}
                </div>
              </div>
              {donorsForId === campaign.id && (
                <div className="w-full">
                  <CampaignDonors
                    campaignId={campaign.id}
                    campaignName={campaign.name}
                    onClose={() => setDonorsForId(null)}
                  />
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FundraisingCampaigns;
