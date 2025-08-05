import React, { useState } from 'react';
import StripePayment from './StripePayment';

const DonatePage: React.FC = () => {
  const [donationType, setDonationType] = useState<'one-time' | 'recurring'>('one-time');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach'>('card');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [donorInfo, setDonorInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    zipCode: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!amount || parseFloat(amount) < 1) {
      alert('Please enter a valid amount (minimum $1.00)');
      return;
    }

    if (!donorInfo.firstName || !donorInfo.lastName || !donorInfo.email) {
      alert('Please fill in all required fields');
      return;
    }

    // Show payment form
    setShowPaymentForm(true);
    setPaymentError(null);
    setPaymentSuccess(false);
  };

  const handlePaymentSuccess = (donation: any) => {
    setPaymentSuccess(true);
    setShowPaymentForm(false);
    setIsProcessing(false);
    
    // Reset form
    setAmount('');
    setDonorInfo({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      zipCode: ''
    });
    
    alert(`Thank you for your donation of $${donation.amount}! Your payment has been processed successfully.`);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setIsProcessing(false);
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
    setPaymentError(null);
  };

  const donationData = {
    amount: parseFloat(amount),
    donation_type: donationType,
    frequency: donationType === 'recurring' ? frequency : undefined,
    payment_method: paymentMethod,
    donor_first_name: donorInfo.firstName,
    donor_last_name: donorInfo.lastName,
    donor_email: donorInfo.email,
    donor_phone: donorInfo.phone || undefined,
    donor_address: donorInfo.address || undefined,
    donor_zip_code: donorInfo.zipCode || undefined,
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Support Our Church</h1>
          <p className="text-lg text-gray-600">
            Your generous donation helps us continue our mission and serve our community.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Online Donation Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Online Donation</h2>
            
            {!showPaymentForm ? (
              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* Donation Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How often would you like to donate?
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="one-time"
                        checked={donationType === 'one-time'}
                        onChange={(e) => setDonationType(e.target.value as 'one-time' | 'recurring')}
                        className="mr-2"
                      />
                      One-Time
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="recurring"
                        checked={donationType === 'recurring'}
                        onChange={(e) => setDonationType(e.target.value as 'one-time' | 'recurring')}
                        className="mr-2"
                      />
                      Recurring
                    </label>
                  </div>
                </div>

                {/* Frequency (for recurring) */}
                {donationType === 'recurring' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Donation Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                      required
                      className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'ach')}
                        className="mr-2"
                      />
                      Credit/Debit Card
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="ach"
                        checked={paymentMethod === 'ach'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'ach')}
                        className="mr-2"
                      />
                      Bank Account (ACH)
                    </label>
                  </div>
                </div>

                {/* Donor Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800">Donor Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={donorInfo.firstName}
                        onChange={(e) => setDonorInfo({...donorInfo, firstName: e.target.value})}
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={donorInfo.lastName}
                        onChange={(e) => setDonorInfo({...donorInfo, lastName: e.target.value})}
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={donorInfo.email}
                      onChange={(e) => setDonorInfo({...donorInfo, email: e.target.value})}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={donorInfo.phone}
                      onChange={(e) => setDonorInfo({...donorInfo, phone: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Address
                    </label>
                    <input
                      type="text"
                      value={donorInfo.address}
                      onChange={(e) => setDonorInfo({...donorInfo, address: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zip Code
                    </label>
                    <input
                      type="text"
                      value={donorInfo.zipCode}
                      onChange={(e) => setDonorInfo({...donorInfo, zipCode: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Authorization */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-700">
                    I authorize this merchant or their agent to {paymentMethod === 'card' ? 'charge my credit card' : 'debit my account'} 
                    in the amount above {donationType === 'recurring' ? `via ${frequency} recurring payments` : ''} as soon as I click the "Continue to Payment" button below. 
                    I agree that {paymentMethod === 'card' ? 'credit card' : 'ACH'} transactions I authorize comply with all applicable law.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-200"
                >
                  {isProcessing ? 'Processing...' : `Continue to Payment - $${amount || '0.00'}`}
                </button>
              </form>
            ) : (
              <StripePayment
                donationData={donationData}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handlePaymentCancel}
              />
            )}

            {paymentError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{paymentError}</p>
              </div>
            )}

            {paymentSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-600">Payment successful! Thank you for your donation.</p>
              </div>
            )}
          </div>

          {/* Alternative Payment Methods */}
          <div className="space-y-6">
            {/* Zelle */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Donate via Zelle</h3>
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <div className="text-center space-y-4">
                  <div>
                    <span className="text-lg font-bold text-blue-700 block mb-2">Zelle Email Address:</span>
                    <div 
                      className="bg-white border border-blue-300 rounded-lg p-3 inline-block cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText('abunearegawitx@gmail.com');
                        // Visual feedback
                        const element = event?.target as HTMLElement;
                        if (element) {
                          element.style.backgroundColor = '#dbeafe';
                          setTimeout(() => {
                            element.style.backgroundColor = '';
                          }, 200);
                        }
                      }}
                      title="Click to copy email address"
                    >
                      <span className="text-lg text-blue-900 font-mono select-all">abunearegawitx@gmail.com</span>
                    </div>
                  </div>
                  
                  <div className="text-left space-y-3">
                    <h4 className="font-semibold text-gray-800">How to donate via Zelle:</h4>
                    <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                      <li>Open your banking app or Zelle app</li>
                      <li>Select "Send Money" or "Send with Zelle"</li>
                      <li>Enter the email address: <span className="font-mono text-blue-600">abunearegawitx@gmail.com</span></li>
                      <li>Enter your donation amount</li>
                      <li>Add a note: "Donation to Abune Aregawi Church - [Your Phone Number]"</li>
                      <li>Review and send your payment</li>
                    </ol>
                  </div>
                  
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800 font-medium mb-1">✅ Quick Copy:</p>
                    <p className="text-xs text-green-700">
                      Click the email address above to copy it to your clipboard, then paste it directly into your Zelle app.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Check */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Donate by Check</h3>
              <div className="bg-green-50 border border-green-200 rounded p-4 flex flex-col items-center">
                <span className="text-lg font-bold text-green-700">Make checks payable to:</span>
                <span className="text-lg text-green-900">Abune Aregawi Orthodox Tewahedo Church</span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Questions?</h3>
              <p className="text-gray-600 mb-4">
                For questions about donations, please contact us:
              </p>
              <a 
                href="mailto:abunearegawitx@gmail.com" 
                className="text-blue-600 underline hover:text-blue-800"
              >
                abunearegawitx@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonatePage;

export {}; 