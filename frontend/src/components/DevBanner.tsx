import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const BANNER_DISMISS_KEY = 'devBannerDismissed';

const bannerStyles: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  position: 'sticky',
  top: 0,
  zIndex: 1000,
  background: 'linear-gradient(90deg, #0f766e 0%, #115e59 100%)', // teal shades
  color: '#fff',
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.2)'
};

const innerStyles: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12
};

const textStyles: React.CSSProperties = {
  flex: 1,
  lineHeight: 1.35
};

const closeBtnStyles: React.CSSProperties = {
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer'
};

export default function DevBanner() {
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(BANNER_DISMISS_KEY);
    setDismissed(stored === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  const englishMsg =
    'This application is currently under development. Some sections may still be incomplete. We ask for your patience. Your help in identifying any issues would be a great blessing to us. God bless you.';

  const tigrignaMsg =
    'እንኳዕ ደሓን መጻእኩም። እዚ ንኦርቶዶክስ ተዋህዶ ቤተክርስቲያን ትግራይ ዝኸውን መርበብ ሓበሬታ ኣብዚ ሕዚ እዋን ኣብ ምምዕባል ይርከብ። ገለ ክፍልታት ገና ዘይተማልኡ ክኾኑ ይኽእሉ እዮም። ትዕግስትኹም ንሓትት። ዝኾነ ጉዳይ ኣብ ምልላይ ትገብርዎ ሓገዝ ዓቢ በረኸት ምኾነና። ኣምላኽ እግዚአብሔር ይባርክኩም።';

  const content = language === 'ti' ? tigrignaMsg : englishMsg;

  return (
    <div style={bannerStyles} role="status" aria-live="polite">
      <div style={innerStyles}>
        <div style={textStyles}>{content}</div>
        <button onClick={handleDismiss} style={closeBtnStyles} aria-label="Dismiss banner">
          ×
        </button>
      </div>
    </div>
  );
}
