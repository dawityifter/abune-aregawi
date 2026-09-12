import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import Hero from './Hero';
import LiveStreamBanner from './LiveStreamBanner';
import QuickLinks from './QuickLinks';
import ParishAnnouncements from './ParishAnnouncements';
import LiturgicalToday from './LiturgicalToday';
import NextService from './NextService';
import FullSchedule from './FullSchedule';
import WhatsHappeningSection from './sections/WhatsHappeningSection';
import CalendarSection from './sections/CalendarSection';
import GrowSpirituallySection from './sections/GrowSpirituallySection';
// import DashboardPreviewSection from './sections/DashboardPreviewSection';
import Footer from './sections/Footer';
import PromoPopup from './PromoPopup';
// import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { lang } = useI18n();
  const { hash } = useLocation();

  // React Router v6 does not scroll to hash fragments on its own.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className={`min-h-screen bg-neutral-50 ${lang === 'ti' ? 'text-tigrigna' : ''}`}>
      <Hero />
      <LiveStreamBanner />

      {/* The two questions a member actually opens the site to ask, answered
          first: what day is it in the Church, and when can I come.
          Both used to sit below a five-card grid whose largest card was a
          forty-line class schedule. */}
      <div className="container mx-auto px-4 pt-8">
        <LiturgicalToday variant="home" />
      </div>
      <NextService />
      <FullSchedule />

      <ParishAnnouncements />
      <WhatsHappeningSection />
      <CalendarSection />
      <GrowSpirituallySection />
      {/* Demoted below the parish's own news: the priest, the map and the
          survey are things a visitor looks up once, not what a returning
          member came for. */}
      <QuickLinks />
      <Footer />
      <PromoPopup />
    </div>
  );
};

export default HomePage; 
