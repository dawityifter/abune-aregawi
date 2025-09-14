import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface Pledge {
  id: number;
  member_id: number | null;
  amount: number;
  pledge_type: string;
  event_name: string | null;
  status: 'pending' | 'fulfilled' | 'expired' | 'cancelled';
  pledge_date: string;
  due_date: string | null;
  fulfilled_date: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  zip_code: string | null;
  notes: string | null;
  donation_id: number | null;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  donation?: {
    id: number;
    amount: number;
    status: string;
  };
}

interface PledgeManagementProps {
  eventName?: string; // Optional filter by event
}

const PledgeManagement: React.FC<PledgeManagementProps> = ({ eventName }) => {
  const { t } = useLanguage();
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [showFulfillModal, setShowFulfillModal] = useState(false);

  const fetchPledges = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (eventName) {
        params.append('event_name', eventName);
      }

      const response = await fetch(`/api/pledges?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPledges(data.pledges);
      } else {
        setError(data.message || 'Failed to load pledges');
      }
    } catch (err) {
      console.error('Error fetching pledges:', err);
      setError('Failed to load pledges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPledges();
  }, [eventName]);

  const handleStatusUpdate = async (pledgeId: number, status: string, donationId?: number) => {
    try {
      const updateData: any = { status };
      if (donationId) {
        updateData.donation_id = donationId;
      }

      const response = await fetch(`/api/pledges/${pledgeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        fetchPledges(); // Refresh the list
        setShowFulfillModal(false);
        setSelectedPledge(null);
      } else {
        setError(data.message || 'Failed to update pledge');
      }
    } catch (err) {
      console.error('Error updating pledge:', err);
      setError('Failed to update pledge');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'fulfilled':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {eventName ? `${eventName} Pledge Management` : 'Pledge Management'}
          </h2>
          <p className="text-gray-600">Manage and track pledge fulfillment</p>
        </div>
        <button
          onClick={fetchPledges}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pledges Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            All Pledges ({pledges.length})
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {pledges.map((pledge) => (
            <li key={pledge.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <p className="text-sm font-medium text-gray-900">
                          {pledge.first_name} {pledge.last_name}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(pledge.status)}`}>
                          {pledge.status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-medium">{formatCurrency(pledge.amount)}</span>
                        {pledge.pledge_type !== 'general' && (
                          <span className="ml-2 capitalize">• {pledge.pledge_type}</span>
                        )}
                        {pledge.event_name && (
                          <span className="ml-2">• {pledge.event_name}</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {pledge.email} • {formatDate(pledge.pledge_date)}
                        {pledge.due_date && (
                          <span className="ml-2">• Due: {formatDate(pledge.due_date)}</span>
                        )}
                      </div>
                      {pledge.member && (
                        <div className="mt-1 text-sm text-green-600">
                          ✓ Member: {pledge.member.first_name} {pledge.member.last_name}
                        </div>
                      )}
                      {pledge.donation && (
                        <div className="mt-1 text-sm text-blue-600">
                          💰 Donation: {formatCurrency(pledge.donation.amount)} ({pledge.donation.status})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {pledge.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedPledge(pledge);
                          setShowFulfillModal(true);
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                      >
                        Mark Fulfilled
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(pledge.id, 'cancelled')}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {pledge.status === 'fulfilled' && (
                    <button
                      onClick={() => handleStatusUpdate(pledge.id, 'pending')}
                      className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700"
                    >
                      Mark Pending
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {pledges.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pledges</h3>
            <p className="mt-1 text-sm text-gray-500">
              {eventName ? `No pledges found for ${eventName}` : 'No pledges found'}
            </p>
          </div>
        )}
      </div>

      {/* Fulfillment Modal */}
      {showFulfillModal && selectedPledge && (
        <FulfillmentModal
          pledge={selectedPledge}
          onClose={() => {
            setShowFulfillModal(false);
            setSelectedPledge(null);
          }}
          onFulfill={(donationId) => handleStatusUpdate(selectedPledge.id, 'fulfilled', donationId)}
        />
      )}
    </div>
  );
};

// Fulfillment Modal Component
interface FulfillmentModalProps {
  pledge: Pledge;
  onClose: () => void;
  onFulfill: (donationId?: number) => void;
}

const FulfillmentModal: React.FC<FulfillmentModalProps> = ({ pledge, onClose, onFulfill }) => {
  const [donationId, setDonationId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = donationId.trim() ? parseInt(donationId) : undefined;
    onFulfill(id);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Mark Pledge as Fulfilled
          </h3>

          <div className="mb-4">
            <div className="text-sm text-gray-600">
              <strong>Pledger:</strong> {pledge.first_name} {pledge.last_name}
            </div>
            <div className="text-sm text-gray-600">
              <strong>Amount:</strong> ${pledge.amount}
            </div>
            <div className="text-sm text-gray-600">
              <strong>Email:</strong> {pledge.email}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Donation ID (Optional)
              </label>
              <input
                type="number"
                value={donationId}
                onChange={(e) => setDonationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter donation ID if available"
              />
              <p className="text-xs text-gray-500 mt-1">
                Link this pledge to an existing donation record
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Additional notes about fulfillment..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Mark as Fulfilled
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PledgeManagement;
