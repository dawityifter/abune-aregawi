import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatMoney } from '../../config/merch';

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
  sizes: { size: string; quantity: number }[];
  total_shirts: number;
}

const statusChip: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  canceled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700'
};

const dollars = (value: string) => formatMoney(Math.round(parseFloat(value || '0') * 100));

/**
 * Fulfillment worklist for event merchandise.
 *
 * The size summary at the top is the one number the parish actually has to act
 * on before the event: how many of each size to have printed.
 */
const MerchOrders: React.FC = () => {
  const { firebaseUser } = useAuth();
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

      if (!ordersRes.ok || !summaryRes.ok) throw new Error('Failed to load merchandise orders');

      const ordersData = await ordersRes.json();
      const summaryData = await summaryRes.json();
      setOrders(ordersData.orders || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load merchandise orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load merchandise orders');
    } finally {
      setLoading(false);
    }
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update fulfillment');
      await load();
    } catch (err) {
      console.error('Failed to update fulfillment:', err);
      setError(err instanceof Error ? err.message : 'Failed to update fulfillment');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Merchandise Orders</h2>
        <p className="text-sm text-gray-600">
          Event merchandise sales. These are purchases, not donations — they are booked to
          Event Merchandise Sales (INC012) and never appear on a giving statement.
        </p>
      </div>

      {/* Paid orders only — see the backend note: printing shirts for a pending
          order is a real cost. */}
      {summary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900">
            Shirts to order <span className="font-normal text-gray-500">(paid orders only)</span>
          </h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {summary.sizes.map((s) => (
              <div
                key={s.size}
                className="rounded-lg border border-gray-200 px-4 py-2 text-center min-w-[72px]"
              >
                <div className="text-xs uppercase tracking-wide text-gray-500">{s.size}</div>
                <div className="text-xl font-bold text-gray-900">{s.quantity}</div>
              </div>
            ))}
            <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-2 text-center min-w-[72px]">
              <div className="text-xs uppercase tracking-wide text-primary-700">Total</div>
              <div className="text-xl font-bold text-primary-900">{summary.total_shirts}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by payment status"
          className="rounded-md border-gray-300 text-sm"
        >
          <option value="">All payment statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="canceled">Canceled</option>
          <option value="expired">Expired</option>
        </select>

        <select
          value={fulfillmentFilter}
          onChange={(e) => setFulfillmentFilter(e.target.value)}
          aria-label="Filter by fulfillment status"
          className="rounded-md border-gray-300 text-sm"
        >
          <option value="">All fulfillment states</option>
          <option value="unfulfilled">Unfulfilled</option>
          <option value="fulfilled">Fulfilled</option>
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
          No orders match these filters.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Ordered</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Purchaser</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Sizes</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fulfillment</th>
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
                    {order.items.map((i) => `${i.size}×${i.quantity}`).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="font-medium text-gray-900">{dollars(order.total)}</div>
                    {parseFloat(order.tax) > 0 && (
                      <div className="text-xs text-gray-500">incl. {dollars(order.tax)} tax</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusChip[order.status]}`}>
                      {order.status}
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
                      {order.fulfillment_status === 'fulfilled' ? 'Fulfilled' : 'Mark fulfilled'}
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
