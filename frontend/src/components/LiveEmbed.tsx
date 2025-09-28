import React, { useEffect, useRef, useState } from 'react';

type LiveEmbedProps = {
  id?: string;
  className?: string;
};

// Privacy-enhanced YouTube live embed with optional Unmute overlay
// Uses youtube-nocookie.com; browsers block autoplay with sound, so we start muted and let the user unmute via a button.
const LiveEmbed: React.FC<LiveEmbedProps> = ({ id = 'react-live-stream', className }) => {
  const CHANNEL_ID = 'UCvK6pJUKU2pvoX7bQ3PN2aA';
  const src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${CHANNEL_ID}&autoplay=1&mute=1&modestbranding=1&rel=0&enablejsapi=1`;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);

  // Load IFrame API once and attach a player instance to this iframe
  useEffect(() => {
    const win = window as any;
    const ensureApi = () => {
      if (!win.YT || !win.YT.Player) return false;
      // If iframe element is present and player not yet created, create it
      if (iframeRef.current && !player) {
        const p = new win.YT.Player(iframeRef.current, {
          events: {
            onReady: (e: any) => {
              setPlayer(e.target);
              setReady(true);
              try {
                // Reflect current mute state from player
                const isMuted = !!e.target.isMuted();
                setMuted(isMuted);
              } catch {}
            },
          },
        });
        // Note: setPlayer happens in onReady for accurate API access
      }
      return true;
    };

    if (!ensureApi()) {
      const scriptId = 'youtube-iframe-api';
      if (!document.getElementById(scriptId)) {
        const tag = document.createElement('script');
        tag.id = scriptId;
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      // YouTube calls this when API is ready
      (win as any).onYouTubeIframeAPIReady = () => {
        ensureApi();
      };
    }
  }, [player]);

  const handleToggleMute = () => {
    if (!ready || !player) return;
    try {
      if (muted) {
        if (player.unMute) player.unMute();
        if (player.playVideo) player.playVideo();
        setMuted(false);
      } else {
        if (player.mute) player.mute();
        setMuted(true);
      }
    } catch {
      // If API not ready for any reason, ignore; user can interact with iframe controls
    }
  };

  return (
    <section className={className} aria-label="Live Stream">
      <div
        id={id}
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%', // 16:9
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <iframe
          ref={iframeRef}
          src={src}
          title="Live Stream"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          frameBorder={0}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
        />
        {/* Mute/Unmute toggle overlay */}
        <button
          onClick={handleToggleMute}
          aria-label={muted ? 'Unmute live stream' : 'Mute live stream'}
          aria-pressed={!muted}
          disabled={!ready}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 2,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
          }}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: '0.9rem', color: '#555' }}>
        If the stream doesn’t start automatically,{' '}
        <a
          href="https://www.youtube.com/@debretsehayeotcdallastexas7715/live"
          target="_blank"
          rel="noopener noreferrer"
        >
          open the live page on YouTube
        </a>
        .
      </div>
    </section>
  );
};

export default LiveEmbed;
