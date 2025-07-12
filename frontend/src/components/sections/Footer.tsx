import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="traditional-footer py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 justify-center text-center place-items-center">
          {/* Contact Information */}
          <div className="info-block w-full flex-1">
            <h3 className="clergy-info mb-4">
              <i className="fas fa-star-of-david mr-2"></i>
              Location
            </h3>
            <p className="contact-info">
              1621 S Jupiter Rd, Garland, TX 75042
            </p>
          </div>
          {/* Phone */}
          <div className="info-block w-full flex-1">
            <h3 className="clergy-info mb-4">
              <i className="fas fa-phone mr-2"></i>
              Contact
            </h3>
            <p className="contact-info">
              (469) XXX-XXXX
            </p>
          </div>
        </div>
        <div className="text-center mt-8 pt-8 border-t border-accent-400">
            <p className="text-white/90">&copy; 2025 Tigray Orthodox Church. All rights reserved.</p>
            <p className="mt-4">
            <a href="/credits" className="text-secondary-200 hover:text-secondary-100 transition-colors">
              <i className="fas fa-code mr-2"></i>
              Tech Team / Credits
            </a>
          </p>
        </div>
        {/* Parish Pulse, Email List, Follow Us, Stream Us */}
        <div className="mt-10 pt-8 border-t border-accent-400 flex flex-col md:flex-row items-center justify-center gap-8 text-center">
          {/* Parish Pulse */}
          <Link to="/parish-pulse-sign-up" className="text-secondary-400 hover:text-secondary-200 font-semibold flex items-center gap-2">
            <i className="fas fa-bullhorn"></i>
            Parish Pulse
          </Link>
          {/* Email List */}
          <a href="#" className="text-secondary-400 hover:text-secondary-200 font-semibold flex items-center gap-2">
            <i className="fas fa-envelope"></i>
            Email List
          </a>
          {/* Follow Us */}
          <span className="flex items-center gap-2">
            <span className="text-secondary-400 font-semibold">Follow Us:</span>
            <a href="https://www.facebook.com/abunearegawitx/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-200">
              <i className="fab fa-facebook-f"></i>
            </a>
            <a href="#" className="hover:text-secondary-200">
              <i className="fab fa-twitter"></i>
            </a>
            <a href="#" className="hover:text-secondary-200">
              <i className="fab fa-instagram"></i>
            </a>
            <a href="#" className="hover:text-secondary-200">
              <i className="fab fa-youtube"></i>
            </a>
          </span>
          {/* Stream Us */}
          <a href="#" className="text-secondary-400 hover:text-secondary-200 font-semibold flex items-center gap-2">
            <i className="fas fa-broadcast-tower"></i>
            Stream Us
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 