import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const GrowSpirituallySection: React.FC = () => {
  const { t } = useLanguage();

  // Get channel ID from env or fallback
  const [channelId, setChannelId] = React.useState<string>('UCQXFCGSNdQ1y8GOmqbvRefg');
  const [playlistId, setPlaylistId] = React.useState<string>('UUQXFCGSNdQ1y8GOmqbvRefg');
  const [imgError, setImgError] = React.useState(false);
  const [isLive, setIsLive] = React.useState(false);
  const [liveVideoId, setLiveVideoId] = React.useState<string | null>(null);

  const isProduction = () => {
    return window.location.hostname === 'abunearegawi.church' ||
      window.location.hostname === 'www.abunearegawi.church';
  };

  /**
   * Thursday: 7PM - 10PM (19 - 22)
   * Friday: 7PM - 10PM (19 - 22)
   * Sunday: 4AM - 12PM (4 - 12)
   */
  const isCoreHour = () => {
    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Chicago',
        hour12: false,
        weekday: 'long',
        hour: 'numeric'
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);

      const day = parts.find(p => p.type === 'weekday')?.value;
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);

      if (day === 'Thursday' && hour >= 19 && hour < 22) return true;
      if (day === 'Friday' && hour >= 19 && hour < 22) return true;
      if (day === 'Sunday' && hour >= 4 && hour < 12) return true;

      return false;
    } catch (e) {
      return true;
    }
  };

  React.useEffect(() => {
    const fetchConfigAndStatus = async () => {
      if (!isProduction() || !isCoreHour()) {
        setIsLive(false);
        return;
      }
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

        // 1. Get Config
        const configRes = await fetch(`${apiUrl}/api/youtube/config`);
        const config = await configRes.json();
        const spiritualId = config.spiritualChannelId || 'UCQXFCGSNdQ1y8GOmqbvRefg';

        setChannelId(spiritualId);
        setPlaylistId(spiritualId.substring(0, 1) + 'U' + spiritualId.substring(2));

        // 2. Check Status
        // Pass the spiritual channel ID to the backend
        const statusRes = await fetch(`${apiUrl}/api/youtube/live-status?channelId=${spiritualId}`);
        const statusData = await statusRes.json();

        if (statusData.isLive) {
          setIsLive(true);
          setLiveVideoId(statusData.videoId);
        }
      } catch (error) {
        console.error('Failed to check spiritual channel live status', error);
      }
    };

    fetchConfigAndStatus();
    // Check every 15 minutes if in core hours
    let interval: NodeJS.Timeout;
    if (isProduction() && isCoreHour()) {
      interval = setInterval(fetchConfigAndStatus, 15 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

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