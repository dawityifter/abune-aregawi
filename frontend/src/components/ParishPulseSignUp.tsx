import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const ParishPulseSignUp: React.FC = () => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setError(t('parishPulse.errorRequired'));
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
          {t('parishPulse.title')}
        </h1>
        <p className="text-accent-700 text-center mb-6">
          {t('parishPulse.description')}
        </p>
        {submitted ? (
          <div className="text-green-700 text-center font-semibold py-8">
            {t('parishPulse.thankYou')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md">{error}</div>}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-primary-700 mb-1">{t('parishPulse.fullName')}</label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder={t('parishPulse.namePlaceholder')}
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-primary-700 mb-1">{t('parishPulse.mobileNumber')}</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder={t('parishPulse.phonePlaceholder')}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">{t('parishPulse.submit')}</button>
            <p className="text-xs text-accent-500 text-center mt-2">
              {t('parishPulse.disclaimer')}
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ParishPulseSignUp; 