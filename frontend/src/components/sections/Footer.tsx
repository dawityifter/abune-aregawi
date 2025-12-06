import React from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';

const Footer: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <footer
      className="traditional-footer py-12"
      style={isHome ? { background: 'transparent' } : undefined}
    >
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 justify-center text-center place-items-center">
          {/* Contact Information */}
          <div className="info-block w-full flex-1">
            <h3 className="clergy-info mb-4">
              <i className="fas fa-map-marker mr-2"></i>
              {t('quicklinks.location') || "Location"}
            </h3>
            <p className="contact-info">
              1621 S Jupiter Rd, Garland, TX 75042
            </p>
          </div>
          {/* Phone */}
          <div className="info-block w-full flex-1">
            <h3 className="clergy-info mb-4">
              <i className="fas fa-phone mr-2"></i>
              {t('common.cta.contact')}
            </h3>
            <p className="contact-info">
              (469) XXX-XXXX
            </p>
          </div>
        </div>
        <div className="text-center mt-8 pt-8 border-t border-accent-400">
          <p className="text-white/90">&copy; 2025 Tigray Orthodox Church. All rights reserved.</p>
          <p className="mt-4 flex items-center justify-center gap-4">
            <a href="/credits" className="text-secondary-200 hover:text-secondary-100 transition-colors">
              <i className="fas fa-code mr-2"></i>
              Tech Team / Credits
            </a>
            <span className="text-secondary-400">|</span>
            <a href="/privacy" className="text-secondary-200 hover:text-secondary-100 transition-colors">
              <i className="fas fa-user-shield mr-2"></i>
              Privacy
            </a>
          </p>
        </div>
        {/* Follow Us, Stream Us */}
        <div className="mt-10 pt-8 border-t border-accent-400 flex flex-col md:flex-row items-center justify-center gap-8 text-center">
          {/* Follow Us */}
          <span className="flex items-center gap-2">
            <span className="text-secondary-400 font-semibold">Follow Us:</span>
            <a href="https://www.facebook.com/abunearegawitx/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-200">
              <i className="fab fa-facebook-f"></i>
            </a>
            <button className="hover:text-secondary-200 bg-transparent border-none cursor-pointer">
              <i className="fab fa-twitter"></i>
            </button>
            <button className="hover:text-secondary-200 bg-transparent border-none cursor-pointer">
              <i className="fab fa-instagram"></i>
            </button>
            <button className="hover:text-secondary-200 bg-transparent border-none cursor-pointer">
              <i className="fab fa-youtube"></i>
            </button>
          </span>
          {/* Stream Us */}
          <button className="text-secondary-400 hover:text-secondary-200 font-semibold flex items-center gap-2 bg-transparent border-none cursor-pointer">
            <i className="fas fa-broadcast-tower"></i>
            Stream Us
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 