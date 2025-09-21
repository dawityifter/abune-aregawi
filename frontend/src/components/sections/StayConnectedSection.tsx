import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const StayConnectedSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('stay.connected')}</h2>
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/90 rounded-xl shadow overflow-hidden">
            <img
              src={`${process.env.PUBLIC_URL || ''}/images/meskel.jpeg`}
              alt="Meskel Celebration at Abune Aregawi Church"
              className="w-full h-auto object-contain"
              loading="lazy"
            />
            <div className="p-4 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Meskel Celebration</h3>
              <p className="mt-1 text-sm text-gray-600">Rejoicing in the Finding of the True Cross. Join us in worship, community, and tradition.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StayConnectedSection; 