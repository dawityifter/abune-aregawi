import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import Hero from './Hero';
import LiveStreamBanner from './LiveStreamBanner';
import QuickLinks from './QuickLinks';
import WhatsHappeningSection from './sections/WhatsHappeningSection';
import CalendarSection from './sections/CalendarSection';
import GrowSpirituallySection from './sections/GrowSpirituallySection';
// import DashboardPreviewSection from './sections/DashboardPreviewSection';
import Footer from './sections/Footer';
import useServerWarmup from '../hooks/useServerWarmup';
// import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { lang } = useI18n();

  useServerWarmup();

  return (
    <div
      className={`min-h-screen ${lang === 'ti' ? 'text-tigrigna' : ''}`}
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL || ''}/bylaws/TigrayOrthodox-background.png)`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top left',
        backgroundSize: 'auto',
      }}
    >
      <Hero />
      <LiveStreamBanner />
      <QuickLinks />
      <CalendarSection />
      <GrowSpirituallySection />
      <WhatsHappeningSection />
      <Footer />
    </div>
  );
};

export default HomePage; 
