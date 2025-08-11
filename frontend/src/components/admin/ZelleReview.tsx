import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface ZellePreviewItem {
  gmail_id?: string;
  external_id?: string | null;
  amount?: number | string | null;
  payment_date?: string | null;
  sender_email?: string | null;
  memo_phone_e164?: string | null;
  note_preview?: string | null;
  subject?: string | null;
  matched_member_id?: number | null;
  would_create?: boolean;
  payment_method?: 'zelle';
  payment_type?: string;
  status?: string;
  error?: string;
}

const ZelleReview: React.FC = () => {
  const { currentUser, firebaseUser } = useAuth();
  const [items, setItems] = useState<ZellePreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const fetchPreview = useCallback(async () => {
    if (!firebaseUser || !currentUser?.email) return;
    setLoading(true);
    setError('');
    try {
      const url = `${process.env.REACT_APP_API_URL}/api/zelle/preview/gmail?limit=${encodeURIComponent(String(limit))}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser.getIdToken()}`
        }
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message || `Preview failed with status ${resp.status}`);
      }
      const data = await resp.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load Zelle preview');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, currentUser?.email, limit]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleCreate = useCallback(async (item: ZellePreviewItem) => {
    if (!firebaseUser) return;
    const key = item.gmail_id || item.external_id || Math.random().toString();
    try {
      setBusyIds((m) => ({ ...m, [key]: true }));
      setError('');

      const memberIdInput = (document.getElementById(`memberId-${key}`) as HTMLInputElement | null)?.value?.trim();
      const member_id = item.matched_member_id || (memberIdInput ? Number(memberIdInput) : undefined);
      if (!member_id) {
        throw new Error('Please provide a member ID to reconcile.');
      }

      const paymentTypeSelect = (document.getElementById(`paymentType-${key}`) as HTMLSelectElement | null);
      const payment_type = paymentTypeSelect?.value || 'donation';

      if (!item.external_id) {
        throw new Error('Missing external_id for this item.');
      }
      const numericAmount = typeof item.amount === 'number' ? item.amount : Number(item.amount);
      if (!Number.isFinite(numericAmount) || !item.payment_date) {
        throw new Error('Missing or invalid amount, or missing payment date.');
      }

      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/zelle/reconcile/create-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseUser.getIdToken()}`
        },
        body: JSON.stringify({
          external_id: item.external_id,
          amount: numericAmount,
          payment_date: item.payment_date,
          note: item.note_preview || item.subject || undefined,
          member_id,
          payment_type,
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.message || `Create failed with status ${resp.status}`);
      }
      // Refresh list after success
      await fetchPreview();
    } catch (e: any) {
      setError(e.message || 'Failed to create transaction');
    } finally {
      setBusyIds((m) => ({ ...m, [key]: false }));
    }
  }, [firebaseUser, fetchPreview]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Zelle Review</h2>
          <p className="text-sm text-gray-600">Preview of Gmail-parsed Zelle payments for reconciliation</p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min={1}
            max={25}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value || '10', 10))}
            className="w-20 px-2 py-1 border border-gray-300 rounded"
            aria-label="Limit"
            title="Max results"
          />
          <button
            onClick={fetchPreview}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No candidates found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sender</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone in Memo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matched Member</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Would Create</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">External ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reconcile</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((it, idx) => (
                <tr key={it.gmail_id || it.external_id || idx}>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{it.payment_date || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{
                    (() => {
                      const amt = typeof it.amount === 'number' ? it.amount : Number(it.amount);
                      return Number.isFinite(amt) ? `$${amt.toFixed(2)}` : '-';
                    })()
                  }</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{it.sender_email || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{it.memo_phone_e164 || '-'}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title="Zelle">Zelle</td>
                  <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title={it.note_preview || ''}>{it.note_preview || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    {it.matched_member_id ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        #{it.matched_member_id}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Unmatched
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    {it.would_create ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Yes</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{it.external_id || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      {!it.matched_member_id && (
                        <input
                          id={`memberId-${it.gmail_id || it.external_id || idx}`}
                          type="number"
                          placeholder="Member ID"
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                        />
                      )}
                      <select
                        id={`paymentType-${it.gmail_id || it.external_id || idx}`}
                        className="px-2 py-1 border border-gray-300 rounded"
                        defaultValue={it.payment_type || 'donation'}
                        title="Payment Type"
                      >
                        <option value="membership_due">Membership Due</option>
                        <option value="tithe">Tithe</option>
                        <option value="donation">Donation</option>
                        <option value="event">Event</option>
                        <option value="other">Other</option>
                      </select>
                      <button
                        onClick={() => handleCreate(it)}
                        disabled={!!busyIds[it.gmail_id || it.external_id || String(idx)]}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded"
                        title="Create transaction"
                      >
                        {busyIds[it.gmail_id || it.external_id || String(idx)] ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Preview only: no database changes are made from this view.
      </div>
    </div>
  );
};

export default ZelleReview;
