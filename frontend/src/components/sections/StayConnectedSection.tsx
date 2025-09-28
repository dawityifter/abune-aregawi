import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const StayConnectedSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('stay.connected')}</h2>
        <div className="max-w-5xl mx-auto">
          {/* Content removed: time-specific announcement */}
        </div>
      </div>
    </section>
  );
};

export default StayConnectedSection; 