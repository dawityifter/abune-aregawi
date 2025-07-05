import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const ParticipationSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('participation')}</h2>
        <div className="text-center text-gray-600">
          <p>Volunteer and donation options coming soon...</p>
        </div>
      </div>
    </section>
  );
};

export default ParticipationSection; 