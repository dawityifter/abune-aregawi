import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const GrowSpirituallySection: React.FC = () => {
  const { t } = useLanguage();

  // Get channel ID from env or fallback
  const channelId = process.env.REACT_APP_YOUTUBE_SPIRITUAL_CHANNEL_ID || 'UCQXFCGSNdQ1y8GOmqbvRefg';
  // Derive uploads playlist ID (replace 2nd char 'C' with 'U')
  const playlistId = channelId.substring(0, 1) + 'U' + channelId.substring(2);

  const [imgError, setImgError] = React.useState(false);
  const [isLive, setIsLive] = React.useState(false);
  const [liveVideoId, setLiveVideoId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
        // Pass the spiritual channel ID to the backend
        const response = await fetch(`${apiUrl}/api/youtube/live-status?channelId=${channelId}`);
        const data = await response.json();

        if (data.isLive) {
          setIsLive(true);
          setLiveVideoId(data.videoId);
        }
      } catch (error) {
        console.error('Failed to check spiritual channel live status', error);
      }
    };

    checkLiveStatus();
    // Check every 5 minutes
    const interval = setInterval(checkLiveStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [channelId]);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title flex items-center justify-center gap-3">
          {t('grow.spiritually')}
          {isLive && (
            <span className="animate-pulse bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
              Live
            </span>
          )}
        </h2>
        {imgError ? (
          <div className="text-center text-gray-600 mt-6">
            <p>Spiritual resources and devotionals coming soon...</p>
          </div>
        ) : (
          <div className="mt-6 flex justify-center w-full">
            <div className="w-full max-w-4xl aspect-video rounded-xl shadow-md overflow-hidden bg-black relative">
              <h3 className={`text-xl font-serif text-center text-white py-2 mb-0 ${isLive ? 'bg-red-700' : 'bg-primary-800'}`}>
                {isLive ? '🔴 LIVE NOW: Spiritual Teaching' : t('common.cta.latestTeaching')}
              </h3>

              {isLive ? (
                <iframe
                  src={`https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=0`}
                  title="Live Spiritual Teaching"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed?listType=playlist&list=${playlistId}`}
                  title="Latest Teaching"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default GrowSpirituallySection; 