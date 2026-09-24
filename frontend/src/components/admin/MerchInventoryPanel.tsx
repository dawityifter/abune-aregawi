import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface InventoryItem {
  product_key: string;
  product_name: string;
  size: string;
  /** Left to sell online. Already net of open checkouts. */
  quantity: number;
  /** On someone's Stripe payment page right now: off the count, not yet paid. */
  held: number;
}

const LOW_STOCK = 10;
const cellKey = (i: { product_key: string; size: string }) => `${i.product_key}|${i.size}`;

function groupByProduct(rows: InventoryItem[]): [string, InventoryItem[]][] {
  const groups = new Map<string, InventoryItem[]>();
  for (const row of rows) {
    const existing = groups.get(row.product_name);
    if (existing) existing.push(row);
    else groups.set(row.product_name, [row]);
  }
  return Array.from(groups.entries());
}

/**
 * Shirts left to sell, per size.
 *
 * Online sales take shirts off these numbers on their own. Cash sales at the
 * church do not — staff record them here. Two ways to change a count:
 *   - "Sold for cash": type how many were sold, and it is subtracted. No
 *     arithmetic for whoever is standing at the table.
 *   - "Set count": type the number on the shelf, after a recount.
 * Either way the number the admin was looking at travels with the change, and
 * the server refuses it if an online order moved the count in the meantime.
 *
 * At zero a size is off sale on the public order page.
 */
const MerchInventoryPanel: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [cashSold, setCashSold] = useState<Record<string, string>>({});
  const [setTo, setSetTo] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/merch/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(t('merchAdmin.inv.loadFailed'));
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load merchandise inventory:', err);
      setError(err instanceof Error ? err.message : t('merchAdmin.inv.loadFailed'));
    } finally {
      setLoading(false);
    }
    // t is unstable; adding it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  const save = async (item: InventoryItem, quantity: number, successMessage: string) => {
    if (!firebaseUser) return;
    const key = cellKey(item);
    setSaving(key);
    setError(null);
    setNotice(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/merch/inventory/${encodeURIComponent(item.product_key)}/${encodeURIComponent(item.size)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quantity, expected_quantity: item.quantity })
        }
      );
      const data = await res.json();
      if (res.status === 409) {
        // Show the real number and leave the admin's input in place, so they
        // can check it against the new count and save again.
        setItems((prev) => prev.map((i) => (cellKey(i) === key ? { ...i, quantity: data.current } : i)));
        setError(t('merchAdmin.inv.conflict', { count: data.current }));
        return;
      }
      if (!res.ok) throw new Error(t('merchAdmin.inv.updateFailed'));

      setItems((prev) => prev.map((i) => (cellKey(i) === key ? { ...i, quantity: data.item.quantity } : i)));
      setCashSold((prev) => ({ ...prev, [key]: '' }));
      setSetTo((prev) => ({ ...prev, [key]: '' }));
      setNotice(successMessage);
    } catch (err) {
      console.error('Failed to update merchandise inventory:', err);
      setError(err instanceof Error ? err.message : t('merchAdmin.inv.updateFailed'));
    } finally {
      setSaving(null);
    }
  };

  const parseCount = (raw: string | undefined) => {
    if (raw === undefined || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const labelOf = (item: InventoryItem) =>
    t('merchAdmin.inv.label', { product: item.product_name, size: item.size });

  const recordCashSale = (item: InventoryItem) => {
    const sold = parseCount(cashSold[cellKey(item)]);
    if (sold === null || sold === 0) {
      setError(t('merchAdmin.inv.enterCash'));
      return;
    }
    if (sold > item.quantity) {
      setError(t('merchAdmin.inv.tooMany', { count: item.quantity, label: labelOf(item) }));
      return;
    }
    save(item, item.quantity - sold, t('merchAdmin.inv.recorded', { count: sold, label: labelOf(item) }));
  };

  const setCount = (item: InventoryItem) => {
    const next = parseCount(setTo[cellKey(item)]);
    if (next === null) {
      setError(t('merchAdmin.inv.enterCount'));
      return;
    }
    save(item, next, t('merchAdmin.inv.setTo', { label: labelOf(item), count: next }));
  };

  const inputClass = 'h-10 w-20 rounded-md border-gray-300 text-center text-sm focus:border-primary-500 focus:ring-primary-500';
  const buttonClass = 'h-10 rounded-md px-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-gray-900">{t('merchAdmin.inv.title')}</h3>
      <p className="mt-1 text-sm text-gray-600">{t('merchAdmin.inv.intro')}</p>
      <p className="mt-1 text-sm text-gray-600">
        <span className="font-medium text-gray-700">{t('merchAdmin.inv.awaiting')}</span>:{' '}
        {t('merchAdmin.inv.awaitingHelp')}
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {notice && (
        <div role="status" className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-sm text-green-800">{notice}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {groupByProduct(items).map(([productName, rows]) => (
            <div key={productName}>
              <div className="text-sm font-medium text-gray-700">{productName}</div>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">{t('merchAdmin.inv.col.size')}</th>
                      <th className="py-2 pr-4 font-medium">{t('merchAdmin.inv.col.left')}</th>
                      <th className="py-2 pr-4 font-medium">{t('merchAdmin.inv.awaiting')}</th>
                      <th className="py-2 pr-4 font-medium">{t('merchAdmin.inv.col.cash')}</th>
                      <th className="py-2 font-medium">{t('merchAdmin.inv.col.setCount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((item) => {
                      const key = cellKey(item);
                      const busy = saving === key;
                      const label = labelOf(item);
                      return (
                        <tr key={key}>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{item.size}</td>
                          <td className="py-3 pr-4">
                            <span
                              data-testid={`stock-${key}`}
                              className={`text-lg font-bold ${
                                item.quantity === 0 ? 'text-red-700'
                                  : item.quantity <= LOW_STOCK ? 'text-amber-700' : 'text-gray-900'
                              }`}
                            >
                              {item.quantity}
                            </span>
                            {item.quantity === 0 && (
                              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                {t('merchAdmin.inv.soldOut')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{item.held}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                aria-label={t('merchAdmin.inv.cashAria', { label })}
                                value={cashSold[key] ?? ''}
                                onChange={(e) => setCashSold((prev) => ({ ...prev, [key]: e.target.value }))}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                disabled={busy}
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() => recordCashSale(item)}
                                disabled={busy || !cashSold[key]}
                                className={`${buttonClass} bg-primary-600 text-white hover:bg-primary-700`}
                              >
                                {t('merchAdmin.inv.subtract')}
                              </button>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label={t('merchAdmin.inv.countAria', { label })}
                                value={setTo[key] ?? ''}
                                placeholder={String(item.quantity)}
                                onChange={(e) => setSetTo((prev) => ({ ...prev, [key]: e.target.value }))}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                disabled={busy}
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() => setCount(item)}
                                disabled={busy || setTo[key] === undefined || setTo[key] === ''}
                                className={`${buttonClass} bg-gray-100 text-gray-800 hover:bg-gray-200`}
                              >
                                {t('merchAdmin.inv.save')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MerchInventoryPanel;
