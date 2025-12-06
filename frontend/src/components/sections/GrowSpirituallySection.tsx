import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const GrowSpirituallySection: React.FC = () => {
  const { t } = useLanguage();

  // Get channel ID from env or fallback
  const channelId = process.env.REACT_APP_YOUTUBE_SPIRITUAL_CHANNEL_ID || 'UCQXFCGSNdQ1y8GOmqbvRefg';
  // Derive uploads playlist ID (replace 2nd char 'C' with 'U')
  const playlistId = channelId.substring(0, 1) + 'U' + channelId.substring(2);

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
          <div className="mt-6 flex justify-center w-full">
            <div className="w-full max-w-4xl aspect-video rounded-xl shadow-md overflow-hidden bg-black">
              <h3 className="text-xl font-serif text-center text-white bg-primary-800 py-2 mb-0">
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
        )}
      </div>
    </section>
  );
};

export default GrowSpirituallySection; 