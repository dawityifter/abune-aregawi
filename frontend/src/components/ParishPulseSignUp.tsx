import React, { useState } from 'react';

const ParishPulseSignUp: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setError('Please enter your name and mobile number.');
      return;
    }
    // Here you would send the data to your backend or SMS platform
    setSubmitted(true);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-h2 font-serif text-primary-700 mb-4 text-center flex items-center justify-center gap-2">
          <i className="fas fa-bullhorn text-secondary-400"></i>
          Parish Pulse Sign-Up
        </h1>
        <p className="text-accent-700 text-center mb-6">
          Sign up to receive important SMS messages and updates from our parish. You can opt out at any time by replying "STOP" to any message.
        </p>
        {submitted ? (
          <div className="text-green-700 text-center font-semibold py-8">
            Thank you for signing up! You will receive SMS updates soon.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md">{error}</div>}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-primary-700 mb-1">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Your Name"
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-primary-700 mb-1">Mobile Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g. (555) 123-4567"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">Sign Up</button>
            <p className="text-xs text-accent-500 text-center mt-2">
              By submitting your mobile number, you agree to receive SMS messages from Tigray Orthodox Church. Message & data rates may apply. Reply STOP to unsubscribe.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ParishPulseSignUp; 