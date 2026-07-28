import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface SquareRow {
  id: string;
  square_payment_id: string;
  amount?: string | number | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  note?: string | null;
  square_created_at?: string | null;
  status: string;
  matched_member_id?: number | null;
  matchedMember?: { id: number; first_name?: string; last_name?: string } | null;
}
interface SearchResult { id: number; name: string; phoneNumber?: string | null; }

const PAYMENT_TYPES = ['donation', 'membership_due', 'tithe', 'offering', 'building_fund', 'event', 'other'];

const SquareReview: React.FC = () => {
  const { firebaseUser, currentUser } = useAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<SquareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [beginTime, setBeginTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [rowSearch, setRowSearch] = useState<Record<string, { query: string; results: SearchResult[]; selectedId?: number }>>({});
  const [rowType, setRowType] = useState<Record<string, string>>({});
  const [rowYear, setRowYear] = useState<Record<string, string>>({});
  const [rowReceipt, setRowReceipt] = useState<Record<string, string>>({});
  const currentYear = new Date().getFullYear();

  // Auth-header pattern copied verbatim from ZelleReview.tsx (Authorization: Bearer <idToken>,
  // plus Content-Type on POST bodies).
  const authHeader = useCallback(async () => {
    const token = firebaseUser ? await firebaseUser.getIdToken() : '';
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, [firebaseUser]);

  const fetchQueue = useCallback(async () => {
    if (!firebaseUser || !currentUser?.email) return;
    setLoading(true); setError('');
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/queue?limit=100`, { headers });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Failed to load queue');
      setRows(data.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load Square payments');
    } finally { setLoading(false); }
  }, [firebaseUser, currentUser, authHeader]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const runSync = async () => {
    setLoading(true); setError('');
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/sync`, {
        method: 'POST', headers, body: JSON.stringify({ beginTime: beginTime || undefined, endTime: endTime || undefined })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Sync failed');
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Sync failed');
    } finally { setLoading(false); }
  };

  const searchMember = async (rowId: string, query: string) => {
    setRowSearch(s => ({ ...s, [rowId]: { ...(s[rowId] || { results: [] }), query } }));
    if (query.trim().length < 3) return;
    const headers = await authHeader();
    // Member-search URL and response-shape parsing copied verbatim from ZelleReview.tsx's
    // handleSearchChange: GET /api/members/search?q=<query>, results at data.data.results.
    const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/members/search?q=${encodeURIComponent(query)}`, { headers });
    const data = await resp.json().catch(() => ({}));
    const results: SearchResult[] = (data?.data?.results || []).map((r: any) => ({ id: r.id, name: r.name, phoneNumber: r.phoneNumber }));
    setRowSearch(s => ({ ...s, [rowId]: { ...(s[rowId] || { query: '' }), query, results } }));
  };

  const confirmRow = async (row: SquareRow) => {
    const rs = rowSearch[row.id];
    const memberId = rs?.selectedId ?? row.matched_member_id ?? undefined;
    setBusyIds(b => ({ ...b, [row.id]: true }));
    setError(''); setNotice('');
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/reconcile/create-transaction`, {
        method: 'POST', headers, body: JSON.stringify({
          square_payment_id: row.square_payment_id,
          amount: row.amount,
          payment_date: (row.square_created_at || new Date().toISOString()).slice(0, 10),
          note: row.note,
          buyer_name: row.buyer_name,
          member_id: memberId ?? null,
          payment_type: rowType[row.id] || 'donation',
          for_year: (rowType[row.id] === 'membership_due') ? Number(rowYear[row.id] || currentYear) : undefined,
          receipt_number: rowReceipt[row.id] || undefined
        })
      });
      const data = await resp.json();
      if (!data.success && data.code !== 'EXISTS') throw new Error(data.message || 'Failed');
      setNotice(data.alreadyExisted ? t('square.alreadyRecorded') : t('square.createdOk'));
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Failed to create transaction');
    } finally {
      setBusyIds(b => ({ ...b, [row.id]: false }));
    }
  };

  const ignoreRow = async (row: SquareRow) => {
    setBusyIds(b => ({ ...b, [row.id]: true }));
    try {
      const headers = await authHeader();
      await fetch(`${process.env.REACT_APP_API_URL}/api/square/queue/${row.id}/ignore`, { method: 'POST', headers });
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Failed to ignore');
    } finally {
      setBusyIds(b => ({ ...b, [row.id]: false }));
    }
  };

  const pending = rows.filter(r => r.status === 'NEEDS_REVIEW' || r.status === 'AUTO_MATCHED');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-900">{t('square.title')}</h2>
        <label className="text-sm">{t('square.from')}
          <input type="date" className="ml-1 border rounded px-2 py-1" value={beginTime.slice(0, 10)}
            onChange={e => setBeginTime(e.target.value ? `${e.target.value}T00:00:00Z` : '')} />
        </label>
        <label className="text-sm">{t('square.to')}
          <input type="date" className="ml-1 border rounded px-2 py-1" value={endTime.slice(0, 10)}
            onChange={e => setEndTime(e.target.value ? `${e.target.value}T23:59:59Z` : '')} />
        </label>
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={runSync} disabled={loading}>
          {t('square.sync')}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {notice && <div className="text-green-600 text-sm">{notice}</div>}
      {!loading && pending.length === 0 && <div className="text-gray-500">{t('square.noneToReview')}</div>}

      <div className="space-y-3">
        {pending.map(row => (
          <div key={row.id} className="border rounded p-3 space-y-2">
            <div className="flex justify-between flex-wrap gap-2 text-sm">
              <span><strong>{t('square.amount')}:</strong> ${Number(row.amount || 0).toFixed(2)}</span>
              <span><strong>{t('square.buyer')}:</strong> {row.buyer_name || row.buyer_email || '—'}</span>
              <span><strong>{t('square.status')}:</strong> {row.status}</span>
            </div>
            {row.note && <div className="text-xs text-gray-600">{t('square.note')}: {row.note}</div>}

            <div className="flex flex-wrap gap-2 items-center">
              <input className="border rounded px-2 py-1 text-sm" placeholder={t('square.searchMember')}
                value={rowSearch[row.id]?.query || ''}
                onChange={e => searchMember(row.id, e.target.value)} />
              {rowSearch[row.id]?.results?.length ? (
                <select className="border rounded px-2 py-1 text-sm"
                  value={rowSearch[row.id]?.selectedId || ''}
                  onChange={e => setRowSearch(s => ({ ...s, [row.id]: { ...(s[row.id]!), selectedId: Number(e.target.value) } }))}>
                  <option value="">—</option>
                  {rowSearch[row.id]!.results.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : null}

              <select className="border rounded px-2 py-1 text-sm" value={rowType[row.id] || 'donation'}
                onChange={e => setRowType(s => ({ ...s, [row.id]: e.target.value }))}>
                {PAYMENT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
              {rowType[row.id] === 'membership_due' && (
                <input className="border rounded px-2 py-1 text-sm w-20" type="number" placeholder={t('square.year')}
                  value={rowYear[row.id] || String(currentYear)}
                  onChange={e => setRowYear(s => ({ ...s, [row.id]: e.target.value }))} />
              )}
              <input className="border rounded px-2 py-1 text-sm w-24" placeholder={t('square.receipt')}
                value={rowReceipt[row.id] || ''}
                onChange={e => setRowReceipt(s => ({ ...s, [row.id]: e.target.value }))} />

              <button className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                disabled={busyIds[row.id]} onClick={() => confirmRow(row)}>{t('square.confirm')}</button>
              <button className="px-3 py-1 rounded bg-gray-300 disabled:opacity-50"
                disabled={busyIds[row.id]} onClick={() => ignoreRow(row)}>{t('square.ignore')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SquareReview;
