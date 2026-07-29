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
  card_brand?: string | null;
  card_last4?: string | null;
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
  const [rowAnonymous, setRowAnonymous] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'review' | 'ignored'>('review');
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
      // Review tab uses the default (pending) filter; Ignored tab requests IGNORED.
      const statusParam = tab === 'ignored' ? '&status=IGNORED' : '';
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/queue?limit=100${statusParam}`, { headers });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Failed to load queue');
      setRows(data.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load Square payments');
    } finally { setLoading(false); }
  }, [firebaseUser, currentUser, authHeader, tab]);

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
    const isAnon = !!rowAnonymous[row.id];
    const memberId = isAnon ? null : (rs?.selectedId ?? row.matched_member_id ?? null);
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
    setError(''); setNotice('');
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

  const restoreRow = async (row: SquareRow) => {
    setBusyIds(b => ({ ...b, [row.id]: true }));
    setError(''); setNotice('');
    try {
      const headers = await authHeader();
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/square/queue/${row.id}/restore`, { method: 'POST', headers });
      const data = await resp.json().catch(() => ({}));
      if (!data.success) throw new Error(data.message || 'Restore failed');
      setNotice(t('square.restoredOk'));
      await fetchQueue();
    } catch (e: any) {
      setError(e.message || 'Failed to restore');
    } finally {
      setBusyIds(b => ({ ...b, [row.id]: false }));
    }
  };

  // Rows for the active tab, newest payment first. The backend already orders by
  // square_created_at DESC; the client sort guarantees it regardless of fetch order.
  const visibleRows = rows
    .filter(r => tab === 'ignored'
      ? r.status === 'IGNORED'
      : (r.status === 'NEEDS_REVIEW' || r.status === 'AUTO_MATCHED'))
    .sort((a, b) => new Date(b.square_created_at || 0).getTime() - new Date(a.square_created_at || 0).getTime());

  const fmtAmount = (a?: string | number | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(a || 0));

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const cardLabel = (row: SquareRow) => {
    if (!row.card_brand && !row.card_last4) return null;
    return `${row.card_brand || t('square.card')}${row.card_last4 ? ` ••${row.card_last4}` : ''}`;
  };

  const buyerLabel = (row: SquareRow) => {
    if (row.buyer_name && row.buyer_email) return `${row.buyer_name} · ${row.buyer_email}`;
    return row.buyer_name || row.buyer_email || null;
  };

  const prettyType = (pt: string) => pt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const statusMeta = (status: string) => {
    if (status === 'AUTO_MATCHED') return { label: t('square.autoMatched'), cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200' };
    if (status === 'IGNORED') return { label: t('square.ignoredTab'), cls: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200' };
    return { label: t('square.needsReview'), cls: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' };
  };

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200';

  // Confirm is only allowed once the payment is attributed: either a member is
  // chosen/auto-matched, or the treasurer has explicitly marked it anonymous.
  const canConfirm = (row: SquareRow) =>
    (rowSearch[row.id]?.selectedId ?? row.matched_member_id) != null || !!rowAnonymous[row.id];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header / toolbar */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold tracking-tight text-white">Sq</span>
            <h2 className="text-lg font-semibold text-slate-900">{t('square.title')}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? t('square.loading')
              : tab === 'ignored'
                ? `${visibleRows.length} ${t('square.ignoredCountLabel')}`
                : `${visibleRows.length} ${t('square.awaitingReview')}`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t('square.from')}
            <input type="date" className={`mt-1 ${inputCls}`} value={beginTime.slice(0, 10)}
              onChange={e => setBeginTime(e.target.value ? `${e.target.value}T00:00:00Z` : '')} />
          </label>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t('square.to')}
            <input type="date" className={`mt-1 ${inputCls}`} value={endTime.slice(0, 10)}
              onChange={e => setEndTime(e.target.value ? `${e.target.value}T23:59:59Z` : '')} />
          </label>
          <button onClick={runSync} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50">
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('square.sync')}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(error || notice) && (
        <div className="space-y-2 px-5 pt-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="p-5">
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
          <button type="button" onClick={() => setTab('review')}
            className={`rounded-md px-3 py-1.5 font-medium transition ${tab === 'review' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t('square.review')}
          </button>
          <button type="button" onClick={() => setTab('ignored')}
            className={`rounded-md px-3 py-1.5 font-medium transition ${tab === 'ignored' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t('square.ignoredTab')}
          </button>
        </div>

        {loading && visibleRows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <svg className="h-5 w-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {t('square.loading')}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">
              {tab === 'ignored' ? t('square.noneIgnored') : t('square.allCaughtUp')}
            </p>
            {tab !== 'ignored' && <p className="mt-1 text-sm text-slate-500">{t('square.noneToReview')}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map(row => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
                {/* Amount + status + card */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{fmtAmount(row.amount)}</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta(row.status).cls}`}>
                      {statusMeta(row.status).label}
                    </span>
                  </div>
                  {cardLabel(row) && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      {cardLabel(row)}
                    </span>
                  )}
                </div>

                {/* Meta: date · buyer */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                  <span>{formatDateTime(row.square_created_at)}</span>
                  {buyerLabel(row) && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-700">{buyerLabel(row)}</span>
                    </>
                  )}
                </div>

                {row.note && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{row.note}</p>
                )}

                {row.matchedMember && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('square.suggested')}</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      {`${row.matchedMember.first_name || ''} ${row.matchedMember.last_name || ''}`.trim()}
                    </span>
                  </div>
                )}

                {/* Action row */}
                {tab === 'ignored' ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button disabled={busyIds[row.id]} onClick={() => restoreRow(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4" />
                      </svg>
                      {t('square.restore')}
                    </button>
                  </div>
                ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <input className={`${inputCls} w-full sm:w-48 disabled:bg-slate-100 disabled:text-slate-400`}
                    placeholder={t('square.searchMember')}
                    disabled={!!rowAnonymous[row.id]}
                    value={rowSearch[row.id]?.query || ''}
                    onChange={e => searchMember(row.id, e.target.value)} />
                  {rowSearch[row.id]?.results?.length ? (
                    <select className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
                      disabled={!!rowAnonymous[row.id]}
                      value={rowSearch[row.id]?.selectedId || ''}
                      onChange={e => {
                        const selectedId = Number(e.target.value);
                        setRowSearch(s => ({ ...s, [row.id]: { ...(s[row.id]!), selectedId } }));
                        if (selectedId) setRowAnonymous(a => ({ ...a, [row.id]: false }));
                      }}>
                      <option value="">{t('square.selectMember')}</option>
                      {rowSearch[row.id]!.results.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  ) : null}
                  <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                    <input type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={!!rowAnonymous[row.id]}
                      onChange={e => setRowAnonymous(a => ({ ...a, [row.id]: e.target.checked }))} />
                    {t('square.anonymous')}
                  </label>

                  <select className={inputCls} value={rowType[row.id] || 'donation'}
                    onChange={e => setRowType(s => ({ ...s, [row.id]: e.target.value }))}>
                    {PAYMENT_TYPES.map(pt => <option key={pt} value={pt}>{prettyType(pt)}</option>)}
                  </select>
                  {rowType[row.id] === 'membership_due' && (
                    <input className={`${inputCls} w-20`} type="number" placeholder={t('square.year')}
                      value={rowYear[row.id] || String(currentYear)}
                      onChange={e => setRowYear(s => ({ ...s, [row.id]: e.target.value }))} />
                  )}
                  <input className={`${inputCls} w-28`} placeholder={t('square.receipt')}
                    value={rowReceipt[row.id] || ''}
                    onChange={e => setRowReceipt(s => ({ ...s, [row.id]: e.target.value }))} />

                  <div className="ml-auto flex items-center gap-2">
                    <button disabled={busyIds[row.id] || !canConfirm(row)} onClick={() => confirmRow(row)}
                      title={!canConfirm(row) ? t('square.confirmHint') : undefined}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {busyIds[row.id] ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {t('square.confirm')}
                    </button>
                    <button disabled={busyIds[row.id]} onClick={() => ignoreRow(row)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                      {t('square.ignore')}
                    </button>
                  </div>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SquareReview;
