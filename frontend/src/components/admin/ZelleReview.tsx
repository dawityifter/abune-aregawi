import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateTimeForDisplay } from '../../utils/dateUtils';
import { fetchPledgeBalance, PledgeBalance } from '../../utils/pledgeBalanceApi';

const SEARCH_DEBOUNCE_MS = 300;

interface QueueItem {
  id: string;
  external_id: string;
  payer_name?: string | null;
  amount?: number | string | null;
  payment_date?: string | null;
  email_received_at?: string | null;
  note?: string | null;
  subject?: string | null;
  status: string;
  transaction_id?: number | null;
  bank_transaction_id?: number | null;
  matched_member_id?: number | null;
  match_confidence?: string | null;
  match_source?: string | null;
  matched_by?: number | null;
  matched_at?: string | null;
  matchedMember?: { id: number; first_name?: string; last_name?: string } | null;
  transaction?: { id: number; amount?: string; payment_type?: string; receipt_number?: string | null; external_id?: string | null } | null;
}

interface DuplicateCandidate {
  transaction_id: number;
  amount: string | number;
  payment_date: string;
  payment_type?: string;
  receipt_number?: string | null;
  origin?: 'bank' | 'zelle_email' | 'manual';
  bank_row?: { id: number; date: string; payer_name?: string | null; status?: string } | null;
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
}

const STATUS_OPTIONS = ['NEEDS_REVIEW', 'MATCHED', 'CREATED', 'BANK_POSTED', 'AUTO_CREATED', 'IGNORED', 'ERROR'];

// Same list as Bank Reconciliation. Loans are not offered: they are recorded
// from the Loans screen, and the server refuses them here.
const PAYMENT_TYPES = [
  { value: 'donation', label: 'Donation (General)' },
  { value: 'tithe', label: 'Tithe (አስራት)' },
  { value: 'membership_due', label: 'Membership Due (ወርሃዊ ክፍያ)' },
  { value: 'offering', label: 'Offering (መባእ)' },
  { value: 'building_fund', label: 'Building Fund (ንሕንጻ)' },
  { value: 'event', label: 'Event / Fundraising (ንበዓል)' },
  { value: 'tigray_hunger_fundraiser', label: 'Tigray Hunger Fundraiser (ረድኤት ንትግራይ)' },
  { value: 'pledge_drive', label: 'Pledge Drive (መብጸዓ)' },
  { value: 'vow', label: 'Vow / Selet (ስለት)' },
  { value: 'religious_item_sales', label: 'Religious Item Sales (ንዋየ ቅድሳት)' },
  { value: 'other', label: 'Other (ሌላ)' },
];

// An email-created payment the bank has not confirmed after this many days is
// worth a look: the Zelle may have been reversed or never posted.
const AWAITING_BANK_WARN_DAYS = 10;

const isBankHash = (value?: string | null) => /^[a-f0-9]{32}$/i.test(String(value || ''));

const daysSince = (dateOnly?: string | null) => {
  if (!dateOnly) return 0;
  const then = Date.parse(`${String(dateOnly).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(then) ? Math.floor((Date.now() - then) / 86400000) : 0;
};

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
  // Per-row Create form, the duplicate candidates a refused Create returned,
  // and a one-line outcome notice.
  // recordPledge/pledgeAmount: open a pledge with this payment, offered (as in
  // Bank Reconciliation and Add Payment) only when the member has none.
  type CreateInput = { paymentType: string; forYear?: string; receipt?: string; recordPledge?: boolean; pledgeAmount?: string };
  const [createInputs, setCreateInputs] = useState<Record<string, CreateInput>>({});
  const [duplicates, setDuplicates] = useState<Record<string, DuplicateCandidate[]>>({});
  const [notice, setNotice] = useState<string>('');
  const [pledgeWarning, setPledgeWarning] = useState<string>('');
  // Each member's position in the live drive, looked up only for Pledge Drive
  // rows (the server only credits that type). undefined = not looked up yet.
  const [pledgeByMember, setPledgeByMember] = useState<Record<number, PledgeBalance | null>>({});
  const pledgeLookups = useRef<Set<number>>(new Set());

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

  // The learned key this match writes is built from the payer name, so a row
  // whose email had none cannot be matched until the treasurer supplies one —
  // the backend returns 400 PAYER_NAME_REQUIRED. Gate it here so the rule is
  // visible before the click rather than arriving as a server error after it.
  const payerNameMissing = (item: QueueItem) =>
    !item.payer_name && !(matchInputs[item.id]?.payerName || '').trim();

  const handleMatch = async (item: QueueItem) => {
    const memberId = rowSearch[item.id]?.selectedId;
    if (!memberId) { setError('Search for and select a member to match.'); return; }
    if (payerNameMissing(item)) {
      setError('Enter the payer name for this row before saving the match.');
      return;
    }

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

  const createInputFor = (itemId: string): CreateInput => createInputs[itemId] || { paymentType: 'donation' };
  const setCreateInput = (itemId: string, patch: Partial<CreateInput>) =>
    setCreateInputs(prev => ({ ...prev, [itemId]: { ...createInputFor(itemId), ...patch } }));

  // The member Create posts for: a fresh selection, else a match a treasurer
  // already confirmed. A NEEDS_REVIEW row's matchedMember is only the system's
  // suggestion and is never posted against without a selection.
  const memberForCreate = (item: QueueItem) =>
    rowSearch[item.id]?.selectedId || (item.status === 'MATCHED' ? item.matchedMember?.id : null) || null;

  // Look up the pledge balance for every Pledge Drive row with a member, once
  // per member.
  useEffect(() => {
    const needed = new Set<number>();
    for (const item of items) {
      if (item.transaction_id) continue;
      const memberId = memberForCreate(item);
      if (memberId && createInputFor(item.id).paymentType === 'pledge_drive' && !(memberId in pledgeByMember)) {
        needed.add(memberId);
      }
    }
    needed.forEach((memberId) => {
      if (pledgeLookups.current.has(memberId)) return;
      pledgeLookups.current.add(memberId);
      fetchPledgeBalance(memberId)
        .then((balance) => setPledgeByMember(prev => ({ ...prev, [memberId]: balance })))
        .catch(() => setPledgeByMember(prev => ({ ...prev, [memberId]: null })))
        .finally(() => pledgeLookups.current.delete(memberId));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, createInputs, rowSearch, pledgeByMember]);

  // What a Pledge Drive create will send: a pledge amount only when the member
  // has no open pledge and the treasurer chose to record one.
  const pledgeAmountFor = (item: QueueItem): number | undefined => {
    const input = createInputFor(item.id);
    const memberId = memberForCreate(item);
    if (input.paymentType !== 'pledge_drive' || !memberId || pledgeByMember[memberId] || !input.recordPledge) return undefined;
    const amount = parseFloat(input.pledgeAmount ?? String(item.amount ?? ''));
    return amount >= 1 ? amount : undefined;
  };

  const handleCreate = async (item: QueueItem, force = false) => {
    const memberId = memberForCreate(item);
    if (!memberId) { setError('Search for and select a member first.'); return; }
    if (payerNameMissing(item)) { setError('Enter the payer name for this row before creating.'); return; }
    const input = createInputFor(item.id);

    setBusyIds(prev => ({ ...prev, [item.id]: true }));
    setError('');
    setNotice('');
    setPledgeWarning('');
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/zelle/queue/${item.id}/create-transaction`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            member_id: memberId,
            payment_type: input.paymentType,
            for_year: input.paymentType === 'membership_due' && input.forYear ? Number(input.forYear) : undefined,
            receipt_number: input.receipt?.trim() || undefined,
            payer_name: matchInputs[item.id]?.payerName || undefined,
            pledge_amount: pledgeAmountFor(item),
            force: force || undefined
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === 'POSSIBLE_DUPLICATE') {
        setDuplicates(prev => ({ ...prev, [item.id]: data.candidates || [] }));
        return;
      }
      if (res.status === 409 && (data.code === 'POSTED_BY_BANK' || data.code === 'ALREADY_POSTED')) {
        setNotice(data.code === 'POSTED_BY_BANK' ? t('zelleReview.postedByBankNotice') : (data.message || ''));
        await loadQueue();
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.message || 'Create failed');
      setNotice(t('zelleReview.created'));
      // The payment is recorded either way; a pledge that could not be made or
      // credited is shown on its own so the treasurer knows to fix it.
      if (data.pledge_error) setPledgeWarning(data.pledge_error);
      // The member's pledge position just changed.
      setPledgeByMember(prev => { const next = { ...prev }; delete next[memberId]; return next; });
      setDuplicates(prev => { const next = { ...prev }; delete next[item.id]; return next; });
      setRowSearch(prev => { const next = { ...prev }; delete next[item.id]; return next; });
      await loadQueue();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusyIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleAttach = async (item: QueueItem, transactionId: number) => {
    setBusyIds(prev => ({ ...prev, [item.id]: true }));
    setError('');
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/zelle/queue/${item.id}/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ transaction_id: transactionId })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Attach failed');
      setDuplicates(prev => { const next = { ...prev }; delete next[item.id]; return next; });
      await loadQueue();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusyIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Where an already-posted email stands against the bank.
  const postedStatus = (item: QueueItem): { label: string; tone: 'green' | 'gray' | 'amber' } => {
    if (item.status === 'BANK_POSTED') return { label: t('zelleReview.status.postedByBank'), tone: 'green' };
    if (item.bank_transaction_id || isBankHash(item.transaction?.external_id)) {
      return { label: t('zelleReview.status.bankConfirmed'), tone: 'green' };
    }
    const days = daysSince(item.payment_date);
    return days > AWAITING_BANK_WARN_DAYS
      ? { label: t('zelleReview.status.awaitingBankDays', { days }), tone: 'amber' }
      : { label: t('zelleReview.status.awaitingBank'), tone: 'gray' };
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

      {notice && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded" role="status">
          {notice}
        </div>
      )}

      {pledgeWarning && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded" role="alert">
          <p className="text-sm font-semibold text-red-800">{t('zelleReview.pledge.notRecorded')}</p>
          <p className="text-sm text-red-900">{pledgeWarning}</p>
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
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matched Member</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {items.map((item, index) => {
                const memberName = item.matchedMember
                  ? `${item.matchedMember.first_name || ''} ${item.matchedMember.last_name || ''}`.trim()
                  : null;
                return (
                  // Zebra striping plus a hover tint: rows are tall and wide (the
                  // Match column holds a whole form), so the treasurer needs help
                  // keeping their place across it. Cells align to the top so the
                  // date, amount and payer sit level with the start of the row.
                  <tr
                    key={item.id}
                    data-testid="zelle-row"
                    className={`align-top transition-colors hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-200'}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {item.email_received_at
                        ? formatDateTimeForDisplay(item.email_received_at)
                        : (item.payment_date || '-')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right tabular-nums font-medium">{formatAmount(item.amount)}</td>
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
                      {item.transaction_id ? (() => {
                        const posted = postedStatus(item);
                        const toneClass = posted.tone === 'green'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : posted.tone === 'amber'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-gray-50 text-gray-700 border-gray-200';
                        return (
                          <span className={`inline-block text-xs px-2 py-0.5 rounded border ${toneClass}`}>
                            {posted.label}
                          </span>
                        );
                      })() : (
                        <div className="flex flex-col gap-2">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search member by name or phone…"
                              className="w-48 bg-white border border-gray-300 rounded px-2 py-1 text-sm"
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
                            <>
                              <input
                                type="text"
                                placeholder="Payer name (required)"
                                className={`w-48 rounded px-2 py-1 text-sm border ${
                                  payerNameMissing(item)
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-gray-300 bg-white'
                                }`}
                                value={matchInputs[item.id]?.payerName || ''}
                                onChange={e => setMatchInputs(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], payerName: e.target.value }
                                }))}
                              />
                              {payerNameMissing(item) && (
                                <span className="text-xs text-amber-700">
                                  Payer name is required — this email didn&apos;t include one. Enter it as
                                  it appears on the bank statement.
                                </span>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            title={
                              !rowSearch[item.id]?.selectedId
                                ? 'Search for and select a member first'
                                : payerNameMissing(item)
                                  ? 'Enter the payer name for this row first'
                                  : 'Save this payer to member match'
                            }
                            onClick={() => handleMatch(item)}
                            disabled={!!busyIds[item.id] || !rowSearch[item.id]?.selectedId || payerNameMissing(item)}
                            className="self-start px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                          >
                            Save
                          </button>

                          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
                            <select
                              aria-label={t('zelleReview.paymentType')}
                              value={createInputFor(item.id).paymentType}
                              onChange={e => setCreateInput(item.id, { paymentType: e.target.value })}
                              className="w-48 bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              {PAYMENT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            {(() => {
                              const memberId = memberForCreate(item);
                              if (createInputFor(item.id).paymentType !== 'pledge_drive' || !memberId || !(memberId in pledgeByMember)) return null;
                              const balance = pledgeByMember[memberId];
                              const paid = Number(item.amount) || 0;
                              if (balance) {
                                return (
                                  <div className="w-64 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900" data-testid="zelle-open-pledge">
                                    <p className="font-semibold">{balance.campaign_name}</p>
                                    <p>{t('fundraising.activePledge', {
                                      pledged: formatAmount(balance.pledged_amount),
                                      remaining: formatAmount(balance.remaining_amount)
                                    })}</p>
                                    <p className="mt-1 text-emerald-700">{t('zelleReview.pledge.credits', { amount: formatAmount(paid) })}</p>
                                  </div>
                                );
                              }
                              const input = createInputFor(item.id);
                              const pledgeValue = input.pledgeAmount ?? String(item.amount ?? '');
                              const pledged = parseFloat(pledgeValue);
                              return (
                                <div className="w-64 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                                  <p className="font-semibold mb-1">{t('zelleReview.pledge.noOpenPledge')}</p>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={!!input.recordPledge}
                                      onChange={e => setCreateInput(item.id, { recordPledge: e.target.checked })}
                                    />
                                    <span>{t('fundraising.alsoRecordPledge')}</span>
                                  </label>
                                  {input.recordPledge && (
                                    <div className="mt-2">
                                      <label htmlFor={`zelle-pledge-amount-${item.id}`} className="block font-semibold mb-0.5">
                                        {t('fundraising.pledgeAmountLabel')}
                                      </label>
                                      <input
                                        id={`zelle-pledge-amount-${item.id}`}
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={pledgeValue}
                                        onChange={e => setCreateInput(item.id, { pledgeAmount: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                                      />
                                      <p className="mt-1">
                                        {pledged > paid
                                          ? t('zelleReview.pledge.leavesOutstanding', { paid: formatAmount(paid), remaining: formatAmount(pledged - paid) })
                                          : t('zelleReview.pledge.paidInFull', { amount: formatAmount(paid) })}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {createInputFor(item.id).paymentType === 'membership_due' && (
                              <input
                                type="number"
                                aria-label={t('zelleReview.forYear')}
                                placeholder={t('zelleReview.forYear')}
                                value={createInputFor(item.id).forYear || ''}
                                onChange={e => setCreateInput(item.id, { forYear: e.target.value })}
                                className="w-48 bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            )}
                            <input
                              type="text"
                              aria-label={t('zelleReview.receiptOptional')}
                              placeholder={t('zelleReview.receiptOptional')}
                              value={createInputFor(item.id).receipt || ''}
                              onChange={e => setCreateInput(item.id, { receipt: e.target.value })}
                              className="w-48 bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              title={t('zelleReview.createTitle')}
                              onClick={() => handleCreate(item)}
                              disabled={!!busyIds[item.id] || !memberForCreate(item) || payerNameMissing(item)}
                              className="self-start px-3 py-1 text-sm bg-green-700 text-white rounded disabled:opacity-50"
                            >
                              {t('zelleReview.createTransaction')}
                            </button>
                          </div>

                          {duplicates[item.id] && (
                            <div className="border border-amber-300 bg-amber-50 rounded p-2 w-72" role="alert">
                              <p className="text-xs font-semibold text-amber-900 mb-1">{t('zelleReview.duplicate.title')}</p>
                              {duplicates[item.id].map(c => (
                                <div key={c.transaction_id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2 py-1 mb-1">
                                  <span className="text-xs text-gray-700">
                                    #{c.transaction_id} · {formatAmount(c.amount)} · {c.payment_date}
                                    {c.origin ? ` · ${t(`zelleReview.duplicate.origin.${c.origin}`)}` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!!busyIds[item.id]}
                                    onClick={() => handleAttach(item, c.transaction_id)}
                                    className="px-2 py-0.5 text-xs bg-amber-600 text-white rounded disabled:opacity-50"
                                  >
                                    {t('zelleReview.duplicate.attach')}
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                disabled={!!busyIds[item.id]}
                                onClick={() => {
                                  if (window.confirm(t('zelleReview.duplicate.confirmCreateAnyway'))) handleCreate(item, true);
                                }}
                                className="text-xs text-red-700 underline"
                              >
                                {t('zelleReview.duplicate.createAnyway')}
                              </button>
                            </div>
                          )}
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
