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
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { language } = useLanguage();

  return (
    <div className={`min-h-screen ${language === 'ti' ? 'text-tigrigna' : ''}`}>
      <HeroSection />
      <div className="flex justify-center my-6">
        <Link to="/donate">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg transition duration-200">
            Donate
          </button>
        </Link>
      </div>
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