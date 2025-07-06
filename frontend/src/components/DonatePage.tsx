import React from 'react';

const DonatePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">Support Our Church</h1>
        <p className="text-lg text-gray-700 mb-4 text-center">
          Your generous donation helps us continue our mission and serve our community. Thank you for your support!
        </p>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Donate via Zelle</h2>
          <div className="bg-blue-50 border border-blue-200 rounded p-4 flex flex-col items-center">
            <span className="text-lg font-bold text-blue-700">Zelle Email:</span>
            <span className="text-lg text-blue-900 select-all">abunearegawitx@gmail.com</span>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Donate by Check</h2>
          <div className="bg-green-50 border border-green-200 rounded p-4 flex flex-col items-center">
            <span className="text-lg font-bold text-green-700">Make checks payable to:</span>
            <span className="text-lg text-green-900">Abune Aregawi Orthodox Tewahedo Church</span>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Donate Online (PayPal)</h2>
          <div className="flex flex-col items-center">
            <a
              href="https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg text-lg shadow-md transition duration-200 mb-2"
            >
              Donate with PayPal
            </a>
            <span className="text-sm text-gray-500">(You will be redirected to PayPal's secure site)</span>
          </div>
        </div>
        <div className="text-center text-gray-500 text-sm mt-8">
          For questions, please contact us at <a href="mailto:abunearegawitx@gmail.com" className="text-blue-600 underline">abunearegawitx@gmail.com</a>
        </div>
      </div>
    </div>
  );
};

export default DonatePage;

export {}; 