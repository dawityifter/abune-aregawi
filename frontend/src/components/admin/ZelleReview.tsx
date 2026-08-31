import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const SEARCH_DEBOUNCE_MS = 300;

interface QueueItem {
  id: string;
  external_id: string;
  payer_name?: string | null;
  amount?: number | string | null;
  payment_date?: string | null;
  note?: string | null;
  subject?: string | null;
  status: string;
  transaction_id?: number | null;
  matched_member_id?: number | null;
  match_confidence?: string | null;
  match_source?: string | null;
  matched_by?: number | null;
  matched_at?: string | null;
  matchedMember?: { id: number; first_name?: string; last_name?: string } | null;
  transaction?: { id: number; amount?: string; payment_type?: string; receipt_number?: string | null } | null;
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
}

const STATUS_OPTIONS = ['NEEDS_REVIEW', 'MATCHED', 'AUTO_CREATED', 'CREATED', 'IGNORED', 'ERROR'];

const ZelleReview: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [matchInputs, setMatchInputs] = useState<Record<string, { payerName?: string }>>({});

  // Per-row member search state for the Match column: the treasurer types a
  // name, sees candidate members, and picks one before Save is enabled. This
  // mirrors the row-scoped search pattern the pre-rewrite version of this
  // screen used against the same /api/members/search endpoint.
  type SearchResult = { id: number; name: string; phoneNumber?: string | null; isActive?: boolean };
  type RowSearchState = { query: string; results: SearchResult[]; loading: boolean; selectedId?: number; selectedName?: string };
  const [rowSearch, setRowSearch] = useState<Record<string, RowSearchState>>({});

  // Keep the input responsive on every keystroke, but only let the debounced
  // value flow into loadQueue's deps so typing doesn't fire one request per
  // character against a paginated endpoint.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  // Reset to page 1 once the debounced search actually changes, not on every keystroke.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadQueue = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError('');
    try {
      const token = await firebaseUser.getIdToken();
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/zelle/queue?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load Zelle emails');
      setItems(data.items || []);
      setPagination(data.pagination || { total: 0, page: 1, pages: 1 });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, page, limit, debouncedSearch, statusFilter]);

  const handleSyncNow = useCallback(async () => {
    if (!firebaseUser) return;
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const url = `${process.env.REACT_APP_API_URL}/api/zelle/sync/gmail`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${await firebaseUser.getIdToken()}` }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.message || `Sync failed with status ${resp.status}`);
      }
      const s = data.stats || {};
      setSyncMessage(`Sync complete — auto-created: ${s.autoCreated ?? 0}, needs review: ${s.needsReview ?? 0}, skipped: ${s.skipped ?? 0}, errors: ${s.errors ?? 0}`);
      await loadQueue();
    } catch (e: any) {
      setError(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, loadQueue]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleSearchChange = useCallback(async (itemId: string, query: string) => {
    setRowSearch(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { results: [], selectedId: undefined, selectedName: undefined }), query, loading: query.trim().length >= 3 }
    }));

    if (!firebaseUser) return;
    if (query.trim().length < 3) {
      setRowSearch(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), results: [], loading: false } as RowSearchState }));
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();
      const url = `${process.env.REACT_APP_API_URL}/api/members/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      const results: SearchResult[] = data?.data?.results || [];
      setRowSearch(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), query, results, loading: false } }));
    } catch {
      setRowSearch(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), loading: false } as RowSearchState }));
    }
  }, [firebaseUser]);

  const handleSelectMember = useCallback((itemId: string, result: SearchResult) => {
    setRowSearch(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { results: [], query: '' }), selectedId: result.id, selectedName: result.name, query: result.name, results: [] }
    }));
  }, []);

  const handleMatch = async (item: QueueItem) => {
    const memberId = rowSearch[item.id]?.selectedId;
    if (!memberId) { setError('Search for and select a member to match.'); return; }

    setBusyIds(prev => ({ ...prev, [item.id]: true }));
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/zelle/queue/${item.id}/match`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            member_id: memberId,
            payer_name: matchInputs[item.id]?.payerName || undefined
          })
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Match failed');
      setRowSearch(prev => { const next = { ...prev }; delete next[item.id]; return next; });
      await loadQueue();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusyIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const formatAmount = (amount?: number | string | null) => {
    const amt = typeof amount === 'number' ? amount : Number(amount);
    return Number.isFinite(amt) ? `$${amt.toFixed(2)}` : '-';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('treasurerDashboard.tabs.zelle')}</h2>
          <p className="text-sm text-gray-600">Recorded {t('zelle')} payments awaiting or already matched to a member</p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Filter by memo or payer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 px-2 py-1 border border-gray-300 rounded"
            aria-label="Text filter"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-2 py-1 border border-gray-300 rounded"
            aria-label="Status filter"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={loadQueue}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
          >
            Refresh
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded"
            title="Fetch new Zelle emails and record/match them"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded">
          {syncMessage}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No Zelle payments found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matched Member</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => {
                const memberName = item.matchedMember
                  ? `${item.matchedMember.first_name || ''} ${item.matchedMember.last_name || ''}`.trim()
                  : null;
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.payment_date || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{formatAmount(item.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.payer_name || '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 max-w-5xl whitespace-normal break-words" title={item.note || ''}>{item.note || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {memberName ? (
                        <div className="flex flex-col">
                          <span>{memberName}</span>
                          {(item.match_source || item.match_confidence) && (
                            <span className="text-xs text-gray-500">
                              {[item.match_source, item.match_confidence].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.transaction_id ? (
                        <span className="text-xs text-gray-500">Posted · no changes</span>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search member by name or phone…"
                              className="w-48 border border-gray-300 rounded px-2 py-1 text-sm"
                              value={rowSearch[item.id]?.query || ''}
                              onChange={e => handleSearchChange(item.id, e.target.value)}
                            />
                            {rowSearch[item.id]?.loading && (
                              <div className="absolute right-2 top-1.5 text-xs text-gray-400">Searching…</div>
                            )}
                            {(rowSearch[item.id]?.results?.length || 0) > 0 && (
                              <div className="absolute z-10 mt-1 w-64 max-h-48 overflow-auto bg-white border border-gray-200 rounded shadow">
                                {rowSearch[item.id]!.results!.map(r => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onMouseDown={() => handleSelectMember(item.id, r)}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                                    title={r.phoneNumber ? `${r.name} • ${r.phoneNumber}` : r.name}
                                  >
                                    {r.name} {r.phoneNumber ? `• ${r.phoneNumber}` : ''}{!r.isActive ? ' (inactive)' : ''}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {rowSearch[item.id]?.selectedId && (
                            <div className="text-xs text-gray-600">
                              {`Selected: ${rowSearch[item.id]?.selectedName}`}
                            </div>
                          )}
                          {!item.payer_name && (
                            <input
                              type="text"
                              placeholder="Payer name"
                              className="w-48 border border-gray-300 rounded px-2 py-1 text-sm"
                              value={matchInputs[item.id]?.payerName || ''}
                              onChange={e => setMatchInputs(prev => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], payerName: e.target.value }
                              }))}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleMatch(item)}
                            disabled={!!busyIds[item.id] || !rowSearch[item.id]?.selectedId}
                            className="self-start px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page >= pagination.pages}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ZelleReview;
