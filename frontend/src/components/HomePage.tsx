import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import Hero from './Hero';
import QuickLinks from './QuickLinks';
import WhatsHappeningSection from './sections/WhatsHappeningSection';
import StayConnectedSection from './sections/StayConnectedSection';
import NewcomerSection from './sections/NewcomerSection';
import GrowSpirituallySection from './sections/GrowSpirituallySection';
// import DashboardPreviewSection from './sections/DashboardPreviewSection';
import Footer from './sections/Footer';
// import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { lang } = useI18n();

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
      <QuickLinks />
      <WhatsHappeningSection />
      <StayConnectedSection />
      <NewcomerSection />
      <GrowSpirituallySection />
      <Footer />
    </div>
  );
};

export default HomePage; 