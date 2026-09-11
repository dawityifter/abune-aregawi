import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PledgeTracker from '../components/PledgeTracker';
import ErrorBoundary from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nProvider';
import { useActiveCampaign } from '../hooks/useActiveCampaign';
import { useAuth } from '../contexts/AuthContext';
import { usePledgeBalance } from '../hooks/usePledgeBalance';
import PledgeIntentSelector, { PledgeIntent } from '../components/pledge/PledgeIntentSelector';
import PledgeLaterForm from '../components/pledge/PledgeLaterForm';
import PledgeCheckoutForm from '../components/pledge/PledgeCheckoutForm';

const PledgePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lang, t } = useI18n();
  const { campaign, loading: campaignLoading } = useActiveCampaign();
  const { user, currentUser, firebaseUser } = useAuth();
  const { balance: pledgeBalance } = usePledgeBalance();
  const [intent, setIntent] = useState<PledgeIntent | null>(null);
  const signedIn = Boolean(user);

  // Spec §5.1's rule is EXISTENCE, not outstanding balance: a member already
  // holding an active 'later' pledge in this drive is not offered another one.
  // usePledgeBalance already returns null when there is no such pledge, so its
  // presence is the whole test. Keying on `remaining_amount > 0` (as this did)
  // let a member who had paid in full — or overpaid, giving a negative — back
  // into the intent chooser, where POST /api/pledges then hit the
  // one-active-pledge unique index.
  const hasExistingPledge = signedIn && Boolean(pledgeBalance);
  const pledgeSettled = Boolean(pledgeBalance && pledgeBalance.remaining_amount <= 0);

  // Every giving path ends on the same success panel, and that panel tells the
  // giver they are being redirected. Scheduling the redirect here, rather than
  // in each caller, is what stops the promise and the navigation from drifting
  // apart: the pay-now branch was added wired only to setSuccess(true), so it
  // sat on that panel announcing a redirect that was never coming.
  const completePledge = (pledgeId?: number) => {
    setSuccess(true);
    setTimeout(() => {
      navigate('/thank-you', pledgeId ? { state: { pledgeId } } : undefined);
    }, 2000);
  };

  const handlePledgeSubmit = async (formData: { amount: string; notes?: string }) => {
    try {
      setLoading(true);
      setError(null);

      const idToken = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pledges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          notes: formData.notes,
          // The server requires these and prefills them from the member record
          // it resolves from the token; sending the profile's values keeps the
          // pledge's contact snapshot accurate.
          first_name: currentUser?.first_name || currentUser?.firstName || '',
          last_name: currentUser?.last_name || currentUser?.lastName || ''
        })
      });

      const data = await response.json();
      if (data.success) {
        completePledge(data.pledge.id);
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
              {t('pledge.success.body')}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {t('pledge.success.redirecting')}
          </div>
        </div>
      </div>
    );
  }

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // No live drive: say so, rather than showing a form whose submission the
  // server would refuse with a 503.
  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t('pledge.noCampaign.title')}</h1>
          <p className="text-gray-600">{t('pledge.noCampaign.body')}</p>
        </div>
      </div>
    );
  }

  const campaignName = (lang === 'ti' && campaign.name_ti) || campaign.name;
  const campaignDescription =
    (lang === 'ti' && campaign.description_ti) || campaign.description;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {campaignName}
            </h1>
            <p className="text-xl md:text-2xl mb-6 opacity-90">
              {campaignDescription || t('pledge.hero.defaultDescription')}
            </p>
            <div className="text-lg opacity-75">
              {t('pledge.hero.tagline')}
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
              {/* This heading only fits the actual fill-in-the-amount step: the
                  existing-pledge panel and intent cards below carry their own
                  headings, and showing "Make Your Pledge" above a yes/no
                  question or a "you already have one" notice read oddly. */}
              {intent === 'later' && !hasExistingPledge && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('pledge.form.title')}</h2>
                  <p className="text-gray-600">
                    {t('pledge.form.subtitle')}
                  </p>
                </div>
              )}

              {/* An existing outstanding pledge means the member came back to PAY, not to
                  promise again. Offering a new pledge here is how a campaign ends up
                  double-counting one person's promise. */}
              {hasExistingPledge ? (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold text-gray-900">{t('pledge.existing.title')}</h3>
                  <p className="text-gray-600 mt-1">
                    {pledgeSettled
                      ? t('pledge.existing.settled')
                          .replace('{campaign}', pledgeBalance!.campaign_name)
                      : t('pledge.existing.body')
                          .replace('{remaining}', `$${pledgeBalance!.remaining_amount.toLocaleString()}`)
                          .replace('{campaign}', pledgeBalance!.campaign_name)}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/donate')}
                    className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-white font-medium"
                  >
                    {pledgeSettled ? t('pledge.existing.giveAgain') : t('pledge.existing.payNow')}
                  </button>
                </div>
              ) : intent === null ? (
                <PledgeIntentSelector
                  signedIn={signedIn}
                  onChoose={setIntent}
                  // Same convention ProtectedRoute uses, so the member comes
                  // back here to finish the pledge they came to make rather
                  // than landing on the dashboard.
                  onSignIn={() => navigate('/login', { state: { from: '/pledge' } })}
                />
              ) : intent === 'later' ? (
                <PledgeLaterForm onSubmit={handlePledgeSubmit} loading={loading} />
              ) : (
                <PledgeCheckoutForm
                  anonymous={intent === 'anonymous'}
                  campaignId={campaign.id}
                  onSuccess={completePledge}
                />
              )}
            </div>

            {/* Pledge Tracker */}
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('pledge.progress.title')}</h2>
                <p className="text-gray-600">
                  {t('pledge.progress.body')}
                </p>
              </div>

              <PledgeTracker
                campaignId={campaign.id}
                goalAmount={campaign.goal_amount ? parseFloat(campaign.goal_amount) : undefined}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('pledge.info.secureTitle')}</h3>
                <p className="text-gray-600">{t('pledge.info.secureBody')}</p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
                  <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('pledge.info.flexibleTitle')}</h3>
                <p className="text-gray-600">{t('pledge.info.flexibleBody')}</p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
                  <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('pledge.info.differenceTitle')}</h3>
                <p className="text-gray-600">{t('pledge.info.differenceBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default PledgePage;
