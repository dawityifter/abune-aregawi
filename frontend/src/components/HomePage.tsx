import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import HeroSection from './sections/HeroSection';
import WhatsHappeningSection from './sections/WhatsHappeningSection';
import WatchListenSection from './sections/WatchListenSection';
import ParticipationSection from './sections/ParticipationSection';
import StayConnectedSection from './sections/StayConnectedSection';
import NewcomerSection from './sections/NewcomerSection';
import GrowSpirituallySection from './sections/GrowSpirituallySection';
import DashboardPreviewSection from './sections/DashboardPreviewSection';
import Footer from './sections/Footer';

const HomePage: React.FC = () => {
  const { language } = useLanguage();

  return (
    <div className={`min-h-screen ${language === 'ti' ? 'text-tigrigna' : ''}`}>
      <HeroSection />
      <WhatsHappeningSection />
      <WatchListenSection />
      <ParticipationSection />
      <DashboardPreviewSection />
      <StayConnectedSection />
      <NewcomerSection />
      <GrowSpirituallySection />
      <Footer />
    </div>
  );
};

export default HomePage; 