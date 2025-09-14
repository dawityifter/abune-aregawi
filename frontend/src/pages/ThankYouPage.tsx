import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PledgeTracker from '../components/PledgeTracker';

const ThankYouPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pledgeData, setPledgeData] = useState<any>(null);

  useEffect(() => {
    // Get pledge data from navigation state
    if (location.state?.pledgeId) {
      // In a real app, you might fetch pledge details here
      setPledgeData(location.state);
    }
  }, [location.state]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4">
              <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Thank You!</h1>
            <p className="text-xl md:text-2xl opacity-90">
              Your pledge has been received and recorded
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Thank You Message */}
          <div className="space-y-6">
            {/* What's Next? section */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What's Next?</h2>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100">
                      <span className="text-primary-600 font-semibold text-sm">1</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Check Your Text Message</h3>
                    <p className="text-gray-600">
                      You'll receive a confirmation text message with your pledge details and payment instructions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100">
                      <span className="text-primary-600 font-semibold text-sm">2</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Choose Your Payment Method</h3>
                    <p className="text-gray-600">
                      Pay when you're ready using credit card, bank transfer, cash, Zelle, or other preferred methods.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100">
                      <span className="text-primary-600 font-semibold text-sm">3</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Track Your Impact</h3>
                    <p className="text-gray-600">
                      Witness how your generous contribution helps expand God's house for our growing congregation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Questions?</h3>
              <p className="text-gray-600 mb-4">
                If you have any questions about your pledge or need assistance with payment, please contact us:
              </p>
              <div className="space-y-2 text-gray-700">
                <p>📧 <strong>Email:</strong> abunearegawitx@gmail.com</p>
                <p>📍 <strong>Address:</strong> 1621 S Jupiter Rd, Garland, TX 75042</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Return to Home
              </button>
              <button
                onClick={() => navigate('/donate')}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Make Additional Donation
              </button>
            </div>
          </div>

          {/* Community Progress */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Annual Fundraising Progress</h2>
              <p className="text-gray-600">
                Track our progress for the Abune Aregawi church yearly fundraising event.
              </p>
            </div>

            <PledgeTracker
              showRecentPledges={true}
              compact={false}
            />

            <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Your Support</h3>
              <p className="text-gray-600 mb-4">
                Help us spread the word about this important cause.
              </p>

              <div className="flex flex-wrap gap-3">
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Share on Facebook
                </button>

                <button className="flex items-center px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Share on Twitter
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Your Pledge Makes a Difference</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Every pledge, no matter the size, contributes to our mission of serving our community
              and spreading God's word. Thank you for your generous commitment and continued support.
            </p>
            <div className="mt-6">
              <div className="inline-flex items-center text-primary-600">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">God Bless You</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;
