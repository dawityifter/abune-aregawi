import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

const HeroSection: React.FC = () => {
  const { language, t } = useLanguage();

  return (
    <header
      className="hero-gradient text-white py-16 relative"
      style={{
        backgroundImage: `linear-gradient(135deg, #dc2626cc 0%, #b91c1ccc 50%, #fbbf24cc 100%), url('/mezemiran3.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="container mx-auto px-4 text-center">

        {/* Church Logo and Name */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <img src={require('../../logo.svg').default} alt="Orthodox Cross" className="h-16 w-16" />
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">
            Tigray Orthodox Church
          </h1>
        </div>

        {/* Mission Statement */}
        <div className="mb-12">
          <h2 className="text-h1 font-serif font-bold mb-6">
            {t('welcome.headline')}
          </h2>
          <p className="mission-statement max-w-4xl mx-auto text-yellow-400 font-bold" style={{ textShadow: '2px 2px 8px #000, 0 0 2px #000' }}>
            {t('welcome.subtitle')}
          </p>
        </div>

        {/* Key Information Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-6xl mx-auto">
          <div className="info-block">
            <h3 className="clergy-info mb-4">
              <i className="fas fa-church mr-2"></i>
              {t('priest')}: {t('priest.name')}
            </h3>
            <p className="contact-info">
              {t('priest.title')}
            </p>
          </div>
          <div className="info-block">
            <h3 className="service-time">
              <i className="fas fa-clock mr-2"></i>
              {t('service.times')}
            </h3>
            <div className="contact-info space-y-1">
              <p><strong>{t('morning.prayers')}:</strong> {t('morning.prayers.time')}</p>
              <p><strong>{t('divine.liturgy')}:</strong> {t('divine.liturgy.time')}</p>
            </div>
          </div>
          <div className="info-block">
            <h3 className="clergy-info mb-4">
              <i className="fas fa-star-of-david mr-2"></i>
              {t('location')}
            </h3>
            <p className="contact-info mb-2">
              {t('church.address')}
            </p>
            <a
              href="https://maps.google.com/maps?q=1621+S+Jupiter+Rd,+Garland,+TX+75042"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary-400 hover:text-secondary-300 transition-colors inline-flex items-center"
            >
              <i className="fas fa-directions mr-2"></i>
              {t('get.directions')}
            </a>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <Link to="/church-bylaw" className="btn btn-primary">
            <i className="fas fa-book mr-2"></i>
            {t('church.bylaw')}
          </Link>
          <button 
            className="btn btn-secondary"
            onClick={() => window.open('https://www.facebook.com/abunearegawitx/', '_blank')}
          >
            <i className="fas fa-video mr-2"></i>
            {t('watch.live')}
          </button>
          <Link to="/member-status" className="btn btn-accent">
            <i className="fas fa-chart-bar mr-2"></i>
            {t('member.status')}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default HeroSection; 