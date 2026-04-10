import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const playlistId = 'UUQXFCGSNdQ1y8GOmqbvRefg';

const GrowSpirituallySection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title flex items-center justify-center gap-3">
          {t('grow.spiritually')}
        </h2>
        <div className="mt-6 flex justify-center w-full">
          <div className="w-full max-w-4xl aspect-video rounded-xl shadow-md overflow-hidden bg-black relative">
            <h3 className="text-xl font-serif text-center text-white py-2 mb-0 bg-primary-800">
              {t('common.cta.latestTeaching')}
            </h3>
            <iframe
              src={`https://www.youtube.com/embed?listType=playlist&list=${playlistId}`}
              title="Latest Teaching"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GrowSpirituallySection;
