import React, { useState, useEffect } from 'react';
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
  partial: 'bg-yellow-100 text-yellow-800',
  not_started: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800'
};

const CampaignDonors: React.FC<CampaignDonorsProps> = ({ campaignId, campaignName, onClose }) => {
  const { t } = useLanguage();
  const [donors, setDonors] = useState<CampaignDonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4 font-medium">{t('fundraising.donor')}</th>
                <th className="py-2 pr-4 font-medium text-right">{t('fundraising.pledged')}</th>
                <th className="py-2 pr-4 font-medium text-right">{t('fundraising.collected')}</th>
                <th className="py-2 pr-4 font-medium text-right">{t('fundraising.outstanding')}</th>
                <th className="py-2 font-medium">{t('fundraising.status')}</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((donor) => (
                <tr key={donor.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-gray-900">{donor.name}</td>
                  <td className="py-2 pr-4 text-right">{money(donor.amount)}</td>
                  <td className="py-2 pr-4 text-right">{money(donor.paid_amount)}</td>
                  <td className="py-2 pr-4 text-right">{money(donor.remaining_amount)}</td>
                  <td className="py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[donor.status] || 'bg-gray-100 text-gray-700'}`}>
                      {donor.status}
                    </span>
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

export default CampaignDonors;
