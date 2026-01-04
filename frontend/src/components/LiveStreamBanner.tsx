import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

interface LiveStreamBannerProps {
    channelId?: string;
    channelHandle?: string;
}

const LiveStreamBanner: React.FC<LiveStreamBannerProps> = ({
    channelId = 'UCvK6pJUKU2pvoX7bQ3PN2aA',
    channelHandle = '@debretsehayeotcdallastexas7715'
}) => {
    const { t } = useI18n();
    const [isLive, setIsLive] = useState(false);
    const [mainLive, setMainLive] = useState(false);
    const [spiritualLive, setSpiritualLive] = useState(false);
    const [activeChannelId, setActiveChannelId] = useState(channelId);
    const [streamTitle, setStreamTitle] = useState<string | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);

    const spiritualChannelId = 'UCQXFCGSNdQ1y8GOmqbvRefg';

    const youtubeChannelUrl = `https://www.youtube.com/channel/${activeChannelId}`;
    const youtubeLiveUrl = `https://www.youtube.com/channel/${activeChannelId}/live`;

    useEffect(() => {
        checkIfLive();

        // Check every 2 minutes (more frequent for better detection)
        const interval = setInterval(checkIfLive, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const checkIfLive = async () => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
            const response = await fetch(`${apiUrl}/api/youtube/multi-live-status`);
            const data = await response.json();

            const isMainLive = data.main?.isLive || false;
            const isSpiritualLive = data.spiritual?.isLive || false;

            setMainLive(isMainLive);
            setSpiritualLive(isSpiritualLive);

            // Prioritize Main Channel if both are live (rare)
            if (isMainLive) {
                setActiveChannelId(data.main.channelId);
                setStreamTitle(data.main.title || 'Main Service');
            } else if (isSpiritualLive) {
                setActiveChannelId(data.spiritual.channelId);
                setStreamTitle(data.spiritual.title || 'Spiritual Service');
            }

            setIsLive(isMainLive || isSpiritualLive);
        } catch (error) {
            console.error('Error checking live status:', error);
            setIsLive(false);
        }
    };

    if (!isLive) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white">
            {/* Banner */}
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping"></div>
                            </div>
                            <span className="font-bold text-lg">LIVE NOW</span>
                        </div>
                        <span className="hidden sm:inline text-white/90">
                            {streamTitle ? `${streamTitle} ${t('common.liveNow') || 'is live now'}` : 'Join us for our live service'}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowPlayer(!showPlayer)}
                            className="bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                        >
                            <i className="fas fa-play-circle"></i>
                            {showPlayer ? 'Hide Stream' : 'Watch Live'}
                        </button>
                        <a
                            href={youtubeChannelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/10 hover:bg-white/20 backdrop-blur text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                        >
                            <i className="fab fa-youtube"></i>
                            <span className="hidden sm:inline">Visit Channel</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Embedded Player */}
            {showPlayer && (
                <div className="bg-black">
                    <div className="max-w-7xl mx-auto px-4 py-6">
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                className="absolute top-0 left-0 w-full h-full rounded-lg"
                                src={`https://www.youtube.com/embed/live_stream?channel=${activeChannelId}`}
                                title="Live Stream"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                        <div className="mt-4 text-center">
                            <p className="text-white/70 text-sm">
                                Can't see the stream? <a href={youtubeLiveUrl} target="_blank" rel="noopener noreferrer" className="text-white underline hover:no-underline">Open in YouTube</a>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveStreamBanner;
