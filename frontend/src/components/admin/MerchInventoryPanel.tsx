import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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
      if (!res.ok) throw new Error('Failed to load inventory');
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load merchandise inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
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
        setError(data.message);
        return;
      }
      if (!res.ok) throw new Error(data.message || 'Failed to update inventory');

      setItems((prev) => prev.map((i) => (cellKey(i) === key ? { ...i, quantity: data.item.quantity } : i)));
      setCashSold((prev) => ({ ...prev, [key]: '' }));
      setSetTo((prev) => ({ ...prev, [key]: '' }));
      setNotice(successMessage);
    } catch (err) {
      console.error('Failed to update merchandise inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to update inventory');
    } finally {
      setSaving(null);
    }
  };

  const parseCount = (raw: string | undefined) => {
    if (raw === undefined || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const recordCashSale = (item: InventoryItem) => {
    const sold = parseCount(cashSold[cellKey(item)]);
    if (sold === null || sold === 0) {
      setError('Enter how many shirts were sold for cash.');
      return;
    }
    if (sold > item.quantity) {
      setError(`Only ${item.quantity} ${item.product_name} ${item.size} are on the count. Use "Set count" if the shelf says otherwise.`);
      return;
    }
    save(item, item.quantity - sold, `Recorded ${sold} × ${item.product_name} ${item.size} sold for cash.`);
  };

  const setCount = (item: InventoryItem) => {
    const next = parseCount(setTo[cellKey(item)]);
    if (next === null) {
      setError('Enter the number of shirts on the shelf, 0 or more.');
      return;
    }
    save(item, next, `${item.product_name} ${item.size} set to ${next}.`);
  };

  const inputClass = 'h-10 w-20 rounded-md border-gray-300 text-center text-sm focus:border-primary-500 focus:ring-primary-500';
  const buttonClass = 'h-10 rounded-md px-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-gray-900">Inventory</h3>
      <p className="mt-1 text-sm text-gray-600">
        Shirts left to sell. Online orders come off automatically; record cash sales here.
        A size at 0 can no longer be ordered online.
      </p>
      <p className="mt-1 text-sm text-gray-600">
        <span className="font-medium text-gray-700">Awaiting payment</span> is shirts someone is
        paying for on Stripe right now. They are already off the count; if the purchaser does not
        finish paying within 30 minutes, they go back on sale automatically.
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
                      <th className="py-2 pr-4 font-medium">Size</th>
                      <th className="py-2 pr-4 font-medium">Left to sell</th>
                      <th className="py-2 pr-4 font-medium">Awaiting payment</th>
                      <th className="py-2 pr-4 font-medium">Sold for cash</th>
                      <th className="py-2 font-medium">Set count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((item) => {
                      const key = cellKey(item);
                      const busy = saving === key;
                      const label = `${item.product_name} size ${item.size}`;
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
                                Sold out — off sale
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
                                aria-label={`Shirts sold for cash, ${label}`}
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
                                Subtract
                              </button>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label={`New count, ${label}`}
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
                                Save
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
