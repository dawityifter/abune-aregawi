import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import Hero from './Hero';
import QuickLinks from './QuickLinks';
import WhatsHappeningSection from './sections/WhatsHappeningSection';
import WatchListenSection from './sections/WatchListenSection';
import ParticipationSection from './sections/ParticipationSection';
import StayConnectedSection from './sections/StayConnectedSection';
import NewcomerSection from './sections/NewcomerSection';
import GrowSpirituallySection from './sections/GrowSpirituallySection';
// import DashboardPreviewSection from './sections/DashboardPreviewSection';
import Footer from './sections/Footer';
// import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { lang } = useI18n();

  return (
    <div className={`min-h-screen ${lang === 'ti' ? 'text-tigrigna' : ''}`}>
      <Hero />
      <QuickLinks />
      <WhatsHappeningSection />
      <WatchListenSection />
      <ParticipationSection />
      <StayConnectedSection />
      <NewcomerSection />
      <GrowSpirituallySection />
      <Footer />
    </div>
  );
};

export default HomePage; 