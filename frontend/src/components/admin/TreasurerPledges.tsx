import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useActiveCampaign } from '../../hooks/useActiveCampaign';
import { fetchCampaignDonors, CampaignDonor } from '../../utils/pledgeCampaignApi';
import { fetchPledgeBalance } from '../../utils/pledgeBalanceApi';
import { createPledgeForMember, cancelPledge, updatePledgeAmount } from '../../utils/pledgeAdminApi';
import MemberSearch from './MemberSearch';

interface TreasurerPledgesProps {
  /**
   * Entry is admin/treasurer only — POST /api/pledges honors an explicit
   * member_id for those two roles and silently attributes the pledge to the
   * caller for everyone else, so a wider finance permission here would file
   * pledges against the wrong person.
   */
  canRecord: boolean;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(value || 0);

const STATUS_STYLES: Record<string, string> = {
  fulfilled: 'bg-green-100 text-green-800',
  partially_fulfilled: 'bg-yellow-100 text-yellow-800',
  not_started: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800'
};

const TreasurerPledges: React.FC<TreasurerPledgesProps> = ({ canRecord }) => {
  const { t } = useLanguage();
  const { campaign } = useActiveCampaign();

  const [rows, setRows] = useState<CampaignDonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const load = useCallback(async () => {
    if (!campaign) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCampaignDonors(campaign.id));
    } catch (err: any) {
      setError(err.message || 'Failed to load donors');
    } finally {
      setLoading(false);
    }
  }, [campaign]);

  useEffect(() => { load(); }, [load]);

  const closeAll = () => {
    setRecording(false);
    setCancelling(null);
    setCancelNote('');
    setEditing(null);
    setEditAmount('');
  };

  const afterWrite = async () => {
    closeAll();
    await load();
  };

  if (!campaign) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
        {t('fundraising.noDrive')}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('fundraising.pledgesTitle')} — {campaign.name}
        </h3>
        {canRecord && (
          <button
            onClick={() => { closeAll(); setRecording(true); }}
            className="px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            <i className="fas fa-plus mr-2"></i>{t('fundraising.recordPledge')}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {recording && (
        <RecordPledgeForm
          onCancel={closeAll}
          onSaved={afterWrite}
          onError={setError}
        />
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">…</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-gray-500">{t('fundraising.noPledges')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">{t('fundraising.donor')}</th>
                <th className="px-3 py-2">{t('fundraising.pledged')}</th>
                <th className="px-3 py-2">{t('fundraising.paid')}</th>
                <th className="px-3 py-2">{t('fundraising.outstanding')}</th>
                <th className="px-3 py-2">{t('fundraising.status')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-gray-900">{row.name}</td>
                  <td className="px-3 py-2">{money(row.amount)}</td>
                  <td className="px-3 py-2">{money(row.paid_amount)}</td>
                  <td className="px-3 py-2">{money(row.remaining_amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[row.status] || 'bg-gray-100 text-gray-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canRecord && row.status !== 'cancelled' && (
                      <>
                        {/* A historical row's paid_amount is read straight off its
                            pledged amount, so editing it would restate what a
                            closed drive collected. The API refuses it too. */}
                        {!row.is_historical && (
                          <button
                            onClick={() => {
                              closeAll();
                              setEditing(row.id);
                              setEditAmount(String(row.amount));
                            }}
                            className="px-2 py-1 text-xs border border-gray-300 rounded-md mr-2"
                          >
                            {t('fundraising.edit')}
                          </button>
                        )}
                        <button
                          onClick={() => { closeAll(); setCancelling(row.id); }}
                          className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded-md"
                        >
                          {t('fundraising.cancelPledge')}
                        </button>
                      </>
                    )}

                    {editing === row.id && (
                      <div className="mt-2 text-left bg-gray-50 border border-gray-200 rounded-md p-3">
                        <label className="block text-xs text-gray-600 mb-1" htmlFor={`amount-${row.id}`}>
                          {t('fundraising.newAmount')}
                        </label>
                        <input
                          id={`amount-${row.id}`}
                          type="number"
                          min="1"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-32 px-2 py-1 border border-gray-300 rounded-md"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await updatePledgeAmount(row.id, parseFloat(editAmount));
                                await afterWrite();
                              } catch (err: any) {
                                setError(err.message);
                              }
                            }}
                            className="px-2 py-1 text-xs bg-primary-600 text-white rounded-md"
                          >
                            {t('fundraising.saveAmount')}
                          </button>
                          <button onClick={closeAll} className="px-2 py-1 text-xs border border-gray-300 rounded-md">
                            {t('fundraising.close2')}
                          </button>
                        </div>
                      </div>
                    )}

                    {cancelling === row.id && (
                      <div className="mt-2 text-left bg-red-50 border border-red-200 rounded-md p-3">
                        <label className="block text-xs text-gray-700 mb-1" htmlFor={`reason-${row.id}`}>
                          {t('fundraising.cancelReason')}
                        </label>
                        <input
                          id={`reason-${row.id}`}
                          type="text"
                          value={cancelNote}
                          onChange={(e) => setCancelNote(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            disabled={!cancelNote.trim()}
                            onClick={async () => {
                              try {
                                await cancelPledge(row.id, cancelNote.trim());
                                await afterWrite();
                              } catch (err: any) {
                                setError(err.message);
                              }
                            }}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded-md disabled:opacity-50"
                          >
                            {t('fundraising.confirmCancel')}
                          </button>
                          <button onClick={closeAll} className="px-2 py-1 text-xs border border-gray-300 rounded-md">
                            {t('fundraising.close2')}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface RecordPledgeFormProps {
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

interface PickedMember {
  id: number;
  firstName: string;
  lastName: string;
}

const RecordPledgeForm: React.FC<RecordPledgeFormProps> = ({ onCancel, onSaved, onError }) => {
  const { t } = useLanguage();
  const [member, setMember] = useState<PickedMember | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<{ pledged_amount: number; remaining_amount: number } | null>(null);

  // The database enforces one active 'later' pledge per member per drive with a
  // partial unique index. Asking first turns that constraint violation into an
  // answer the treasurer can act on, before they have typed an amount.
  const handleSelect = async (_id: string, picked?: any) => {
    if (!picked) return;
    setMember({ id: Number(picked.id), firstName: picked.firstName, lastName: picked.lastName });
    setExisting(null);
    try {
      const balance = await fetchPledgeBalance(Number(picked.id));
      if (balance) setExisting(balance);
    } catch {
      /* the duplicate check is advisory; the unique index is the real guard */
    }
  };

  const submit = async () => {
    if (!member || existing) return;
    setSaving(true);
    try {
      await createPledgeForMember({
        member_id: member.id,
        amount: parseFloat(amount),
        first_name: member.firstName,
        last_name: member.lastName,
        notes
      });
      onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const amountValid = parseFloat(amount) >= 1;

  return (
    <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h4 className="font-semibold text-gray-900 mb-3">{t('fundraising.recordPledgeTitle')}</h4>

      <MemberSearch embedded onMemberSelect={handleSelect} selectedMemberId={member ? String(member.id) : null} />

      {existing && member && (
        <div className="mt-3 bg-yellow-50 border border-yellow-300 rounded-md p-3 text-sm text-yellow-900">
          {t('fundraising.alreadyPledged', {
            name: `${member.firstName} ${member.lastName}`,
            pledged: money(existing.pledged_amount),
            remaining: money(existing.remaining_amount)
          })}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="new-pledge-amount">
            {t('fundraising.pledgeAmountLabel')}
          </label>
          <input
            id="new-pledge-amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="new-pledge-notes">
            {t('fundraising.notesOptional')}
          </label>
          <input
            id="new-pledge-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={!member || !amountValid || Boolean(existing) || saving}
          className="px-3 py-2 text-sm bg-primary-600 text-white rounded-md disabled:opacity-50"
        >
          {t('fundraising.savePledge')}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
          {t('fundraising.cancel')}
        </button>
      </div>
    </div>
  );
};

export default TreasurerPledges;
