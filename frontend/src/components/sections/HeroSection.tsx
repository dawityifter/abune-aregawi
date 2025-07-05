import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

const HeroSection: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header className="hero-gradient text-white py-12 relative">
      <div className="container mx-auto px-4 text-center">
        {/* Language Switcher and Auth Links */}
        <div className="absolute top-5 right-5 flex gap-2 z-10">
          <button
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button
            className={`lang-btn ${language === 'ti' ? 'active' : ''}`}
            onClick={() => setLanguage('ti')}
          >
            ትግርኛ
          </button>
          <div className="border-l border-white/30 mx-2"></div>
          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-80">
                {t('welcome')}, {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-white hover:text-accent-300 transition-colors"
              >
                {t('sign.out')}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm text-white hover:text-accent-300 transition-colors"
            >
              {t('sign.in')}
            </Link>
          )}
        </div>

        {/* Church Logo and Name */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <i className="fas fa-cross text-5xl text-accent-800"></i>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {t('church.name')}
          </h1>
        </div>

        {/* Welcome Headline */}
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {t('welcome.headline')}
        </h2>
        <p className="text-lg md:text-xl mb-8 opacity-90 leading-relaxed">
          {t('welcome.subtitle')}
        </p>

        {/* Service Information */}
        <div className="grid md:grid-cols-2 gap-8 mb-8 max-w-4xl mx-auto">
          <div className="glass-effect rounded-xl p-6">
            <h3 className="text-accent-800 font-semibold mb-4 text-lg">
              {t('service.times')}
            </h3>
            <div className="space-y-2">
              <p><strong>{t('sunday')}:</strong> 9:00 AM - 12:00 PM</p>
              <p><strong>{t('wednesday')}:</strong> 6:00 PM - 8:00 PM</p>
              <p><strong>{t('friday')}:</strong> 6:00 PM - 8:00 PM</p>
            </div>
          </div>
          <div className="glass-effect rounded-xl p-6">
            <h3 className="text-accent-800 font-semibold mb-4 text-lg">
              {t('location')}
            </h3>
            <p className="mb-4">
              <i className="fas fa-map-marker-alt mr-2"></i>
              1621 S Jupiter Rd, Garland, TX 75042
            </p>
            <a
              href="https://maps.google.com/maps?q=1621+S+Jupiter+Rd,+Garland,+TX+75042"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-800 hover:underline inline-flex items-center"
            >
              <i className="fas fa-directions mr-2"></i>
              {t('get.directions')}
            </a>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <button className="btn btn-primary">
            {t('plan.visit')}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => window.open('https://www.facebook.com/abunearegawitx/', '_blank')}
          >
            {t('watch.live')}
          </button>
          {currentUser ? (
            <Link to="/dashboard" className="btn btn-accent">
              <i className="fas fa-user mr-2"></i>
              {t('member.dashboard')}
            </Link>
          ) : (
            <Link to="/register" className="btn btn-accent">
              {t('register.member')}
            </Link>
          )}
          {currentUser ? (
            <Link to="/profile" className="btn btn-outline">
              <i className="fas fa-user-circle mr-2"></i>
              {t('view.profile')}
            </Link>
          ) : (
            <Link to="/login" className="btn btn-outline">
              {t('sign.in')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeroSection; 