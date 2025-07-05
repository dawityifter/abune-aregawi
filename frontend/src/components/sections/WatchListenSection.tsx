import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const WatchListenSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('watch.listen')}</h2>
        <div className="text-center text-gray-600">
          <p>Video and audio content coming soon...</p>
        </div>
      </div>
    </section>
  );
};

export default WatchListenSection; 