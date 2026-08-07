import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import Hero from './Hero';
import LiveStreamBanner from './LiveStreamBanner';
import QuickLinks from './QuickLinks';
import ParishAnnouncements from './ParishAnnouncements';
import LiturgicalToday from './LiturgicalToday';
import WhatsHappeningSection from './sections/WhatsHappeningSection';
import CalendarSection from './sections/CalendarSection';
import GrowSpirituallySection from './sections/GrowSpirituallySection';
// import DashboardPreviewSection from './sections/DashboardPreviewSection';
import Footer from './sections/Footer';
import useServerWarmup from '../hooks/useServerWarmup';
import PromoPopup from './PromoPopup';
// import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { lang } = useI18n();
  const { hash } = useLocation();

  useServerWarmup();

  // React Router v6 does not scroll to hash fragments on its own.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

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
      {/* Above the calendar: a visitor should learn what today is without
          having to read a grid. */}
      <div className="container mx-auto px-4 pt-8">
        <LiturgicalToday variant="home" />
      </div>
      <ParishAnnouncements />
      <CalendarSection />
      <GrowSpirituallySection />
      <WhatsHappeningSection />
      <Footer />
      <PromoPopup />
    </div>
  );
};

export default HomePage; 
