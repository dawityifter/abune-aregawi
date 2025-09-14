import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PledgeForm from '../components/PledgeForm';
import PledgeTracker from '../components/PledgeTracker';
import ErrorBoundary from '../components/ErrorBoundary';

interface PledgeFormData {
  amount: string;
  pledge_type: 'general' | 'event' | 'fundraising' | 'tithe';
  event_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address?: string;
  zip_code?: string;
  notes?: string;
}

const PledgePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get event name from URL params
  const eventName = searchParams.get('event') || undefined;

  const handlePledgeSubmit = async (formData: PledgeFormData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pledges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Auto-redirect after success
        setTimeout(() => {
          navigate('/thank-you', { state: { pledgeId: data.pledge.id } });
        }, 2000);
      } else {
        setError(data.message || 'Failed to submit pledge');
      }
    } catch (err) {
      console.error('Pledge submission error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600">
              Your pledge has been recorded successfully. You will receive a confirmation email shortly with payment instructions.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Redirecting to thank you page...
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {eventName ? `${eventName} Fundraising` : 'Make a Pledge'}
            </h1>
            <p className="text-xl md:text-2xl mb-6 opacity-90">
              {eventName
                ? `Support our ${eventName} with your generous pledge`
                : 'Support our church with your generous pledge'
              }
            </p>
            <div className="text-lg opacity-75">
              Your pledge helps us continue our mission of serving our Abune Aregawi church community
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Pledge Form */}
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Make Your Pledge</h2>
                <p className="text-gray-600">
                  Fill out the form below to make your pledge. All information is kept confidential.
                </p>
              </div>

              <PledgeForm
                onSubmit={handlePledgeSubmit}
                loading={loading}
                eventName={eventName}
              />
            </div>

            {/* Pledge Tracker */}
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Annual Fundraising Progress</h2>
                <p className="text-gray-600">
                  Track our progress for the Abune Aregawi church yearly fundraising event.
                </p>
              </div>

              <PledgeTracker
                eventName={eventName}
                showRecentPledges={true}
                compact={false}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
                  <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Private</h3>
                <p className="text-gray-600">Your pledge information is kept confidential and secure.</p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
                  <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Flexible Payment</h3>
                <p className="text-gray-600">Pay when you're ready. We'll send you payment instructions.</p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
                  <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Make a Difference</h3>
                <p className="text-gray-600">Your pledge helps us serve our community and spread God's word.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default PledgePage;
