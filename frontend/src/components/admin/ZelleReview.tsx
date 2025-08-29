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
  matched_member_name?: string | null;
  matched_candidates?: Array<{ id: number; name: string }>;
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
  const [textFilter, setTextFilter] = useState<string>('');
  const [onlyUnmatched, setOnlyUnmatched] = useState<boolean>(false);

  // Per-row reconcile selection and search state
  type SearchResult = { id: number; name: string; phoneNumber?: string | null; isActive?: boolean };
  type RowSearchState = { query: string; results: SearchResult[]; loading: boolean; selectedId?: number };
  const [rowSearch, setRowSearch] = useState<Record<string, RowSearchState>>({});

  const getKey = (it: ZellePreviewItem, idx: number) => it.gmail_id || it.external_id || String(idx);

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

  const handleCreate = useCallback(async (item: ZellePreviewItem, idx?: number) => {
    if (!firebaseUser) return;
    const key = getKey(item, idx ?? 0);
    try {
      setBusyIds((m) => ({ ...m, [key]: true }));
      setError('');

      const selected = rowSearch[key]?.selectedId;
      const member_id = item.matched_member_id || selected;
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
  }, [firebaseUser, fetchPreview, rowSearch]);

  const handleSearchChange = useCallback(async (key: string, query: string) => {
    setRowSearch((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { results: [], selectedId: undefined }), query, loading: query.length >= 3 }
    }));

    if (!firebaseUser) return;
    if (query.trim().length < 3) {
      setRowSearch((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), results: [], loading: false } as RowSearchState }));
      return;
    }

    try {
      const url = `${process.env.REACT_APP_API_URL}/api/members/search?q=${encodeURIComponent(query)}`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${await firebaseUser.getIdToken()}` }
      });
      const data = await resp.json();
      const results: SearchResult[] = data?.data?.results || [];
      setRowSearch((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), query, results, loading: false }
      }));
    } catch (e) {
      setRowSearch((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), loading: false } as RowSearchState }));
    }
  }, [firebaseUser]);

  const handleSelectMember = useCallback((key: string, memberId: number) => {
    setRowSearch((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { results: [], query: '' }), selectedId: memberId }
    }));
  }, []);

  const filteredItems = items.filter((it) => {
    if (onlyUnmatched && it.matched_member_id) return false;
    const q = textFilter.trim().toLowerCase();
    if (!q) return true;
    const fields = [
      it.note_preview || '',
      it.matched_member_name || ''
    ].map(s => String(s).toLowerCase());
    return fields.some(f => f.includes(q));
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Zelle Review</h2>
          <p className="text-sm text-gray-600">Preview of Gmail-parsed Zelle payments for reconciliation</p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Filter by memo or matched name"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            className="w-72 px-2 py-1 border border-gray-300 rounded"
            aria-label="Text filter"
          />
          <label className="flex items-center space-x-1 text-sm text-gray-700">
            <input type="checkbox" checked={onlyUnmatched} onChange={(e) => setOnlyUnmatched(e.target.checked)} />
            <span>Only Unmatched</span>
          </label>
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matched Member</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Would Create</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reconcile</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((it, idx) => (
                <tr key={getKey(it, idx)}>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{it.payment_date || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{
                    (() => {
                      const amt = typeof it.amount === 'number' ? it.amount : Number(it.amount);
                      return Number.isFinite(amt) ? `$${amt.toFixed(2)}` : '-';
                    })()
                  }</td>
                  <td className="px-3 py-2 text-sm text-gray-900 max-w-5xl whitespace-normal break-words" title={it.note_preview || ''}>{it.note_preview || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    {it.matched_member_id ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title={it.matched_member_name || ''}>
                        {it.matched_member_name ? `${it.matched_member_name} ` : ''}#{it.matched_member_id}
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
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      {!it.matched_member_id && (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Type name or phone (3+ chars)"
                            className="w-64 px-2 py-1 border border-gray-300 rounded"
                            value={rowSearch[getKey(it, idx)]?.query || ''}
                            onChange={(e) => handleSearchChange(getKey(it, idx), e.target.value)}
                          />
                          {(rowSearch[getKey(it, idx)]?.loading) && (
                            <div className="absolute right-2 top-1.5 text-xs text-gray-400">Searching…</div>
                          )}
                          {(rowSearch[getKey(it, idx)]?.results?.length || 0) > 0 && (
                            <div className="absolute z-10 mt-1 w-72 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow">
                              {rowSearch[getKey(it, idx)]!.results!.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => handleSelectMember(getKey(it, idx), r.id)}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                                  title={r.phoneNumber ? `${r.name} • ${r.phoneNumber}` : r.name}
                                >
                                  {r.name} {r.phoneNumber ? `• ${r.phoneNumber}` : ''} {!r.isActive ? '(inactive)' : ''}
                                </button>
                              ))}
                            </div>
                          )}
                          {rowSearch[getKey(it, idx)]?.selectedId && (
                            <div className="mt-1 text-xs text-gray-600">Selected: #{rowSearch[getKey(it, idx)]?.selectedId}</div>
                          )}
                        </div>
                      )}
                      <select
                        id={`paymentType-${getKey(it, idx)}`}
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
                        onClick={() => handleCreate(it, idx)}
                        disabled={!!busyIds[getKey(it, idx)]}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded"
                        title="Create transaction"
                      >
                        {busyIds[getKey(it, idx)] ? 'Creating…' : 'Create'}
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
