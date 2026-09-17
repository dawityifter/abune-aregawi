import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchCampaignDonors, CampaignDonor } from '../../utils/pledgeCampaignApi';

interface CampaignDonorsProps {
  campaignId: number;
  campaignName: string;
  onClose: () => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(value || 0);

// Derived from real payments (pledge_balances), so these are the only statuses
// that can appear — legacy_status is frozen and never read here.
const STATUS_STYLES: Record<string, string> = {
  fulfilled: 'bg-green-100 text-green-800',
  // The view emits 'partially_fulfilled'; keying this 'partial' silently fell
  // through to the default grey.
  partially_fulfilled: 'bg-yellow-100 text-yellow-800',
  not_started: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800'
};

type SortKey = 'name' | 'amount';
type SortDirection = 'asc' | 'desc';

const CampaignDonors: React.FC<CampaignDonorsProps> = ({ campaignId, campaignName, onClose }) => {
  const { t } = useLanguage();
  const [donors, setDonors] = useState<CampaignDonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  // Name ascending: the order the rows arrive in is whatever the status
  // grouping produced, which is not something a reader can follow.
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCampaignDonors(campaignId)
      .then((rows) => { if (!cancelled) { setDonors(rows); setLoading(false); } })
      .catch((err) => {
        if (!cancelled) { setError(err.message || 'Failed to load donors'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [campaignId]);

  // Both vocabularies are closed enums that are fully translated, but t() echoes
  // the key back on a miss — so a value added later shows as itself rather than
  // as a dotted key path.
  const labelOr = (key: string, raw: string) => {
    const label = t(key);
    return label === key ? raw : label;
  };

  const statusLabel = (status: string) =>
    labelOr(`fundraising.statusLabels.${status}`, status);

  const methodLabel = (method: string) =>
    labelOr(`treasurerDashboard.transactionList.methods.${method}`, method);

  // Only what this drive actually contains, so no filter option is a dead end.
  const statusOptions = useMemo(
    () => Array.from(new Set(donors.map((d) => d.status))).sort(),
    [donors]
  );
  const methodOptions = useMemo(
    () => Array.from(new Set(donors.flatMap((d) => d.payment_methods))).sort(),
    [donors]
  );

  const visibleDonors = useMemo(() => {
    const filtered = donors.filter((donor) =>
      (!statusFilter || donor.status === statusFilter) &&
      (!methodFilter || donor.payment_methods.includes(methodFilter))
    );

    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => direction * (
      sortKey === 'amount'
        ? (a.amount || 0) - (b.amount || 0)
        : a.name.localeCompare(b.name)
    ));
  }, [donors, statusFilter, methodFilter, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDirection === 'asc' ? '▲' : '▼') : '';

  const sortableHeader = (key: SortKey, label: string, alignRight = false) => (
    <th className={`py-2 pr-4 font-medium ${alignRight ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        aria-sort={sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`inline-flex items-center gap-1 font-medium hover:text-gray-900 ${alignRight ? 'justify-end w-full' : ''}`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">{sortArrow(key)}</span>
      </button>
    </th>
  );

  const isFiltered = Boolean(statusFilter || methodFilter);

  return (
    <div className="mt-4 bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('fundraising.donorsIn')} {campaignName}
        </h3>
        <button onClick={onClose} className="px-3 py-1 text-sm border border-gray-300 rounded-md">
          {t('fundraising.close2')}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-gray-500">…</div>
      ) : !error && donors.length === 0 ? (
        <div className="py-6 text-center text-gray-500">{t('fundraising.noPledges')}</div>
      ) : !error && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <select
              aria-label={t('fundraising.status')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="">{t('fundraising.allStatuses')}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>

            <select
              aria-label={t('fundraising.paymentMethod')}
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="">{t('fundraising.allPayments')}</option>
              {methodOptions.map((method) => (
                <option key={method} value={method}>{methodLabel(method)}</option>
              ))}
            </select>

            {isFiltered && (
              <span className="text-sm text-gray-500">
                {t('fundraising.showing', {
                  shown: String(visibleDonors.length),
                  total: String(donors.length)
                })}
              </span>
            )}
          </div>

          {visibleDonors.length === 0 ? (
            <div className="py-6 text-center text-gray-500">{t('fundraising.noMatches')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    {sortableHeader('name', t('fundraising.donor'))}
                    {sortableHeader('amount', t('fundraising.pledged'), true)}
                    <th className="py-2 pr-4 font-medium text-right">{t('fundraising.collected')}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t('fundraising.outstanding')}</th>
                    <th className="py-2 pr-4 font-medium">{t('fundraising.paymentMethod')}</th>
                    <th className="py-2 font-medium">{t('fundraising.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDonors.map((donor) => (
                    <tr key={donor.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-gray-900">{donor.name}</td>
                      <td className="py-2 pr-4 text-right">{money(donor.amount)}</td>
                      <td className="py-2 pr-4 text-right">{money(donor.paid_amount)}</td>
                      <td className="py-2 pr-4 text-right">
                        {donor.remaining_amount < 0 ? (
                          <span>
                            {money(0)}{' '}
                            <span className="text-xs text-gray-500">
                              {t('fundraising.overBy', { amount: money(-donor.remaining_amount) })}
                            </span>
                          </span>
                        ) : money(donor.remaining_amount)}
                      </td>
                      {/* Empty for a pledge with nothing received, and for legacy
                          drives whose figures never came from a transaction. */}
                      <td className="py-2 pr-4 text-gray-700">
                        {donor.payment_methods.length > 0
                          ? donor.payment_methods.map(methodLabel).join(', ')
                          : '—'}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[donor.status] || 'bg-gray-100 text-gray-700'}`}>
                          {statusLabel(donor.status)}
                        </span>
                        {donor.is_historical && (
                          <span
                            className="ml-2 text-xs text-gray-500"
                            title={t('fundraising.legacyHelp')}
                          >
                            {t('fundraising.legacy')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampaignDonors;
