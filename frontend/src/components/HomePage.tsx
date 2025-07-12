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
      <div className="flex justify-center my-8">
        <Link to="/donate">
          <button className="btn btn-secondary text-lg shadow-lg">
            <i className="fas fa-heart mr-2"></i>
            Donate
          </button>
        </Link>
      </div>
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