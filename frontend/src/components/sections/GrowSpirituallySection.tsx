import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const GrowSpirituallySection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('grow.spiritually')}</h2>
        <div className="text-center text-gray-600">
          <p>Spiritual resources and devotionals coming soon...</p>
        </div>
      </div>
    </section>
  );
};

export default GrowSpirituallySection; 