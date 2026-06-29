import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

interface Promo {
  id: string;
  src: string;
  alt: string;
  expiry: number; // UTC timestamp milliseconds
}

const PROMOS: Promo[] = [
  {
    id: 'bible-camp',
    src: '/images/promo/bible-camp-july4.jpeg',
    alt: 'Bible Camp July 4',
    // July 4, 2026 at 20:00 CST (Daylight time CDT is UTC-5)
    expiry: new Date('2026-07-04T20:00:00-05:00').getTime()
  },
  {
    id: 'garage-sale',
    src: '/images/promo/garage-Sell-July12-14.jpeg',
    alt: 'Garage Sale July 12-14',
    // July 14, 2026 at 20:00 CST (Daylight time CDT is UTC-5)
    expiry: new Date('2026-07-14T20:00:00-05:00').getTime()
  },
  {
    id: 'summer-camp',
    src: '/images/promo/summer-camp-Jun16-July24.jpeg',
    alt: 'Summer Camp June 16 - July 24',
    // July 24, 2026 at 20:00 CST (Daylight time CDT is UTC-5)
    expiry: new Date('2026-07-24T20:00:00-05:00').getTime()
  }
];

const PromoPopup: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Allow overriding check for testing
  const forceShow = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('forcePromoPopup') === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  // Determine active promotions based on current time
  const eligiblePromos = useMemo(() => {
    if (forceShow) return PROMOS;
    const now = Date.now();
    return PROMOS.filter((promo) => now < promo.expiry);
  }, [forceShow]);

  // Setup popup open state and daily frequency capping
  useEffect(() => {
    if (eligiblePromos.length === 0) return;

    const todayStr = new Date().toDateString();
    const lastShown = localStorage.getItem('last_promo_popup_shown_date');

    if (forceShow || lastShown !== todayStr) {
      setIsOpen(true);
      // Only set in storage if not forcing developer view
      if (!forceShow) {
        localStorage.setItem('last_promo_popup_shown_date', todayStr);
      }
    }
  }, [eligiblePromos, forceShow]);

  // Prevent background scroll when popup is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Escape key listener for accessibility/dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto-rotate logic (changes slides every 5 seconds)
  useEffect(() => {
    if (!isOpen || eligiblePromos.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % eligiblePromos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, eligiblePromos.length, isHovered]);

  if (!isOpen || eligiblePromos.length === 0) return null;

  const currentPromo = eligiblePromos[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + eligiblePromos.length) % eligiblePromos.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % eligiblePromos.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Promotional announcement"
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes promoFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes promoImgFadeIn {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
        .animate-promo-fade-in {
          animation: promoFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-promo-img-fade-in {
          animation: promoImgFadeIn 0.4s ease-out forwards;
        }
      `}} />

      {/* Modal Panel */}
      <div
        className="relative max-w-lg sm:max-w-xl w-full bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col select-none transform transition-all duration-300 scale-100 animate-promo-fade-in"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button (X icon for quick dismissal) */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
          aria-label={t('promo.close')}
          title={t('promo.close')}
        >
          <i className="fa-solid fa-xmark text-base"></i>
        </button>

        {/* Carousel Content */}
        <div className="relative aspect-[4/5] sm:aspect-[4/3] max-h-[60vh] w-full flex items-center justify-center overflow-hidden bg-neutral-950">
          <img
            key={currentPromo.id}
            src={currentPromo.src}
            alt={currentPromo.alt}
            className="max-w-full max-h-full object-contain pointer-events-none animate-promo-img-fade-in"
          />

          {/* Navigation Controls */}
          {eligiblePromos.length > 1 && (
            <>
              {/* Prev Button */}
              <button
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                aria-label={t('promo.previous')}
                title={t('promo.previous')}
              >
                <i className="fa-solid fa-chevron-left text-base"></i>
              </button>

              {/* Next Button */}
              <button
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                aria-label={t('promo.next')}
                title={t('promo.next')}
              >
                <i className="fa-solid fa-chevron-right text-base"></i>
              </button>

              {/* Dots Indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center space-x-2 bg-black/35 backdrop-blur-sm px-3 py-1.5 rounded-full">
                {eligiblePromos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                      }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar with Close Button */}
        <div className="bg-neutral-900 border-t border-neutral-850 px-4 py-3 flex justify-center items-center">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full sm:w-auto px-6 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-sm transition-colors border border-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
          >
            {t('promo.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoPopup;
