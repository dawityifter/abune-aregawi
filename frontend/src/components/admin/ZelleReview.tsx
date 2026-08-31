import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

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
  // AuthContext can hand back a differently-identified object on every render
  // (it does in tests). Reading the current user through a ref keeps
  // loadQueue's identity stable across renders instead of retriggering its
  // effect and re-entering the loading state on every commit.
  const firebaseUserRef = useRef(firebaseUser);
  useEffect(() => {
    firebaseUserRef.current = firebaseUser;
  }, [firebaseUser]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [matchInputs, setMatchInputs] = useState<Record<string, { memberId?: string; payerName?: string }>>({});

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await firebaseUserRef.current?.getIdToken();
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set('search', search.trim());
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
  }, [page, limit, search, statusFilter]);

  const handleSyncNow = useCallback(async () => {
    if (!firebaseUserRef.current) return;
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const url = `${process.env.REACT_APP_API_URL}/api/zelle/sync/gmail`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${await firebaseUserRef.current.getIdToken()}` }
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
  }, [loadQueue]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleMatch = async (item: QueueItem) => {
    const memberId = Number(matchInputs[item.id]?.memberId);
    if (!memberId) { setError('Enter a Member ID to match.'); return; }

    setBusyIds(prev => ({ ...prev, [item.id]: true }));
    try {
      const token = await firebaseUserRef.current?.getIdToken();
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Member ID"
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                            value={matchInputs[item.id]?.memberId || ''}
                            onChange={e => setMatchInputs(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], memberId: e.target.value }
                            }))}
                          />
                          {!item.payer_name && (
                            <input
                              type="text"
                              placeholder="Payer name"
                              className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
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
                            disabled={!!busyIds[item.id]}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                          >
                            Match
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
