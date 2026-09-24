import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney } from '../../config/merch';
import MerchInventoryPanel from './MerchInventoryPanel';

interface MerchOrderItem {
  id: number;
  product_name: string;
  size: string;
  quantity: number;
  unit_amount: string;
  total_amount: string;
}

interface MerchOrder {
  id: number;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  status: 'pending' | 'paid' | 'canceled' | 'expired';
  fulfillment_status: 'unfulfilled' | 'fulfilled';
  subtotal: string;
  tax: string;
  total: string;
  event_key: string;
  created_at: string;
  items: MerchOrderItem[];
}

interface SizeSummary {
  sizes: { product_name: string; size: string; quantity: number }[];
  total_shirts: number;
}

const statusChip: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  canceled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700'
};

const PAYMENT_STATUSES = ['paid', 'pending', 'canceled', 'expired'] as const;

const dollars = (value: string) => formatMoney(Math.round(parseFloat(value || '0') * 100));

/**
 * Rows grouped under their garment, first-seen order preserved so the catalog's
 * size run still reads top to bottom rather than alphabetically.
 */
function groupByProduct<T extends { product_name: string }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const existing = groups.get(row.product_name);
    if (existing) existing.push(row);
    else groups.set(row.product_name, [row]);
  }
  return Array.from(groups.entries());
}

/**
 * Fulfillment worklist for event merchandise.
 *
 * The size summary at the top is the one number the parish actually has to act
 * on before the event: how many of each size to have printed.
 */
const MerchOrders: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [summary, setSummary] = useState<SizeSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('paid');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken(true);
      const headers = { Authorization: `Bearer ${token}` };

      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (fulfillmentFilter) params.set('fulfillment_status', fulfillmentFilter);

      const [ordersRes, summaryRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/merch/orders?${params.toString()}`, { headers }),
        fetch(`${process.env.REACT_APP_API_URL}/api/merch/orders/size-summary`, { headers })
      ]);

      if (!ordersRes.ok || !summaryRes.ok) throw new Error(t('merchAdmin.loadFailed'));

      const ordersData = await ordersRes.json();
      const summaryData = await summaryRes.json();
      setOrders(ordersData.orders || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load merchandise orders:', err);
      setError(err instanceof Error ? err.message : t('merchAdmin.loadFailed'));
    } finally {
      setLoading(false);
    }
    // t is unstable; adding it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, statusFilter, fulfillmentFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleFulfillment = async (order: MerchOrder) => {
    if (!firebaseUser) return;
    const next = order.fulfillment_status === 'fulfilled' ? 'unfulfilled' : 'fulfilled';
    try {
      const token = await firebaseUser.getIdToken(true);
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/merch/orders/${order.id}/fulfillment`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fulfillment_status: next })
        }
      );
      if (!res.ok) throw new Error(t('merchAdmin.updateFailed'));
      await load();
    } catch (err) {
      console.error('Failed to update fulfillment:', err);
      setError(err instanceof Error ? err.message : t('merchAdmin.updateFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('merchAdmin.title')}</h2>
        <p className="text-sm text-gray-600">{t('merchAdmin.intro')}</p>
      </div>

      <MerchInventoryPanel />

      {/* Paid orders only: a checkout still awaiting payment is not a sale. */}
      {summary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900">
            {t('merchAdmin.soldOnline')}
          </h3>
          {/* Grouped by garment. A single row of S / M / L tiles would add a
              youth small to an adult small and tell whoever places the supplier
              order to buy the wrong shirts in exactly the right quantity. */}
          <div className="mt-4 space-y-4">
            {groupByProduct(summary.sizes).map(([productName, rows]) => (
              <div key={productName}>
                <div className="text-sm font-medium text-gray-700">{productName}</div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {rows.map((s) => (
                    <div
                      key={`${productName}|${s.size}`}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-center min-w-[72px]"
                    >
                      <div className="text-xs uppercase tracking-wide text-gray-500">{s.size}</div>
                      <div className="text-xl font-bold text-gray-900">{s.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="inline-block rounded-lg bg-primary-50 border border-primary-200 px-4 py-2 text-center min-w-[72px]">
              <div className="text-xs uppercase tracking-wide text-primary-700">{t('merchAdmin.total')}</div>
              <div className="text-xl font-bold text-primary-900">{summary.total_shirts}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('merchAdmin.filterPayment')}
          className="rounded-md border-gray-300 text-sm"
        >
          <option value="">{t('merchAdmin.allPayment')}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`merchAdmin.status.${s}`)}</option>
          ))}
        </select>

        <select
          value={fulfillmentFilter}
          onChange={(e) => setFulfillmentFilter(e.target.value)}
          aria-label={t('merchAdmin.filterFulfillment')}
          className="rounded-md border-gray-300 text-sm"
        >
          <option value="">{t('merchAdmin.allFulfillment')}</option>
          <option value="unfulfilled">{t('merchAdmin.unfulfilled')}</option>
          <option value="fulfilled">{t('merchAdmin.fulfilled')}</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          {t('merchAdmin.noOrders')}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('merchAdmin.col.ordered')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('merchAdmin.col.purchaser')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('merchAdmin.col.sizes')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('merchAdmin.col.total')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('merchAdmin.col.payment')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('merchAdmin.col.fulfillment')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{order.purchaser_name}</div>
                    <div className="text-gray-500">{order.purchaser_email}</div>
                    {order.purchaser_phone && (
                      <div className="text-gray-500">{order.purchaser_phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {groupByProduct(order.items).map(([productName, rows]) => (
                      <div key={productName}>
                        <span className="text-gray-500">{productName}:</span>{' '}
                        {rows.map((i) => `${i.size}×${i.quantity}`).join(', ')}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="font-medium text-gray-900">{dollars(order.total)}</div>
                    {parseFloat(order.tax) > 0 && (
                      <div className="text-xs text-gray-500">{t('merchAdmin.inclTax', { amount: dollars(order.tax) })}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusChip[order.status]}`}>
                      {t(`merchAdmin.status.${order.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleFulfillment(order)}
                      // Only a paid order can be handed over; the server enforces
                      // this too, but a disabled button explains why.
                      disabled={order.status !== 'paid'}
                      className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                        order.fulfillment_status === 'fulfilled'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {order.fulfillment_status === 'fulfilled' ? t('merchAdmin.fulfilled') : t('merchAdmin.markFulfilled')}
                    </button>
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

export default MerchOrders;
