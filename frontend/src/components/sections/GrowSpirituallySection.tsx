import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const GrowSpirituallySection: React.FC = () => {
  const { t } = useLanguage();

  const [imgError, setImgError] = React.useState(false);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('grow.spiritually')}</h2>
        {imgError ? (
          <div className="text-center text-gray-600 mt-6">
            <p>Spiritual resources and devotionals coming soon...</p>
          </div>
        ) : (
          <div className="mt-6 flex justify-center">
            <img
              src="/images/teachings/memher-seyfu-082925.jpeg"
              alt="Teachings by Memher Seyfu"
              className="w-full max-w-4xl h-auto max-h-[60vh] md:max-h-[70vh] object-contain rounded-xl shadow-md"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default GrowSpirituallySection; 