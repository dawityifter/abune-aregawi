import React, { useState } from 'react';
import QRCode from 'react-qr-code';

const DonatePage: React.FC = () => {
  const [donationType, setDonationType] = useState<'one-time' | 'recurring'>('one-time');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach'>('card');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [qrCodeFormat, setQrCodeFormat] = useState<'email' | 'vcard'>('email');
  const [donorInfo, setDonorInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    zipCode: ''
  });
  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    expiration: '',
    cvv: ''
  });
  const [achInfo, setAchInfo] = useState({
    routingNumber: '',
    accountNumber: '',
    accountType: 'checking'
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      alert('Thank you for your donation! This is a demo - in production, this would process through a payment gateway.');
      setIsProcessing(false);
    }, 2000);
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
            
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Card Information */}
              {paymentMethod === 'card' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardInfo.cardNumber}
                      onChange={(e) => setCardInfo({...cardInfo, cardNumber: e.target.value})}
                      placeholder="1234 5678 9012 3456"
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiration (MM/YY)
                      </label>
                      <input
                        type="text"
                        value={cardInfo.expiration}
                        onChange={(e) => setCardInfo({...cardInfo, expiration: e.target.value})}
                        placeholder="MM/YY"
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <input
                        type="text"
                        value={cardInfo.cvv}
                        onChange={(e) => setCardInfo({...cardInfo, cvv: e.target.value})}
                        placeholder="123"
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ACH Information */}
              {paymentMethod === 'ach' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Type
                    </label>
                    <select
                      value={achInfo.accountType}
                      onChange={(e) => setAchInfo({...achInfo, accountType: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={achInfo.routingNumber}
                      onChange={(e) => setAchInfo({...achInfo, routingNumber: e.target.value})}
                      placeholder="123456789"
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={achInfo.accountNumber}
                      onChange={(e) => setAchInfo({...achInfo, accountNumber: e.target.value})}
                      placeholder="Account number"
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>
              )}

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
                  in the amount above {donationType === 'recurring' ? `via ${frequency} recurring payments` : ''} as soon as I click the "Donate" button below. 
                  I agree that {paymentMethod === 'card' ? 'credit card' : 'ACH'} transactions I authorize comply with all applicable law.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-200"
              >
                {isProcessing ? 'Processing...' : `Donate $${amount || '0.00'}`}
              </button>
            </form>
          </div>

          {/* Alternative Payment Methods */}
          <div className="space-y-6">
            {/* Zelle */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Donate via Zelle</h3>
              <div className="bg-blue-50 border border-blue-200 rounded p-4 flex flex-col items-center space-y-4">
                <div className="text-center">
                  <span className="text-lg font-bold text-blue-700 block mb-2">Zelle Email:</span>
                  <span className="text-lg text-blue-900 select-all font-mono">abunearegawitx@gmail.com</span>
                </div>
                
                {/* QR Code Section */}
                <div className="text-center">
                  <p className="text-sm text-blue-700 mb-3">Scan with your bank app or Zelle</p>
                  
                  {/* QR Code Format Toggle */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-600 mr-3">
                      <input
                        type="radio"
                        value="email"
                        checked={qrCodeFormat === 'email'}
                        onChange={(e) => setQrCodeFormat(e.target.value as 'email' | 'vcard')}
                        className="mr-1"
                      />
                      Email Format
                    </label>
                    <label className="text-xs text-gray-600">
                      <input
                        type="radio"
                        value="vcard"
                        checked={qrCodeFormat === 'vcard'}
                        onChange={(e) => setQrCodeFormat(e.target.value as 'email' | 'vcard')}
                        className="mr-1"
                      />
                      Contact Format
                    </label>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm inline-block">
                    <QRCode 
                      value={qrCodeFormat === 'email' 
                        ? "abunearegawitx@gmail.com"
                        : "BEGIN:VCARD\nVERSION:3.0\nEMAIL:abunearegawitx@gmail.com\nFN:Abune Aregawi Church\nORG:Abune Aregawi Orthodox Tewahedo Church\nEND:VCARD"
                      }
                      size={200}
                      level="H"
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Open your bank app and scan this QR code to send money via Zelle
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    If scanning doesn't work, manually enter: abunearegawitx@gmail.com
                  </p>
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