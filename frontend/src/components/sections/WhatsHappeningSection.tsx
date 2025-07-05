import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const WhatsHappeningSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('whats.happening')}</h2>
        <div className="text-center text-gray-600">
          <p>Events and announcements coming soon...</p>
        </div>
      </div>
    </section>
  );
};

export default WhatsHappeningSection; 