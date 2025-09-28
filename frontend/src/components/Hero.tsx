import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

const Hero: React.FC = () => {
  const { lang, t } = useI18n();
  // Support background preview via query param
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const bgParam = params.get('bg');
  const bgMap: Record<string, string> = {
    procession: '/images/hero-procession.jpg',
    sanctuary: '/images/hero-sanctuary.jpg',
  };
  // Decide background: query param overrides; otherwise default to procession and occasionally show sanctuary
  let chosenKey: keyof typeof bgMap = 'procession';
  if (bgParam && (bgParam in bgMap)) {
    chosenKey = bgParam as keyof typeof bgMap;
  } else {
    // 1-in-5 chance to show sanctuary
    if (Math.random() < 0.2) chosenKey = 'sanctuary';
  }
  const bgUrl = bgMap[chosenKey];
  const hasBg = true;
  // Tune vertical focus for specific images
  let bgPosition = 'center';
  if (chosenKey === 'procession') {
    // Pull view slightly down to show heads fully
    bgPosition = 'center 35%'; // adjust as needed (20%-45%)
  } else if (chosenKey === 'sanctuary') {
    bgPosition = 'center';
  }

  return (
    <header
      className={`relative overflow-hidden hero-gradient text-white ${
        hasBg ? 'bg-cover bg-center' : 'bg-cross-lattice'
      }`}
      style={hasBg ? { backgroundImage: `url(${bgUrl})`, backgroundPosition: bgPosition } : undefined}
    > 
      {/* Dark overlay to improve text readability */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 pt-24 pb-16 sm:pt-28 sm:pb-20">
        {/* Title temporarily removed per request */}
        
        {/* Mission Statement */}
        <div className="mb-8 text-center">
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight max-w-5xl mx-auto px-4 drop-shadow-lg">
            We want everyone, everywhere to have an everyday relationship with the lord. By uniting through the Eucharist.
          </p>
        </div>
        
        <p className={`mt-4 max-w-2xl text-base sm:text-lg md:text-xl text-white/90 ${lang === 'ti' ? 'text-tigrigna' : ''}`}>
          {t('hero.subtitle')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/donate" className="btn btn-secondary">
            <i className="fas fa-heart mr-2" />
            {t('hero.cta.give')}
          </Link>
          <a
            href="https://www.youtube.com/@debretsehayeotcdallastexas7715/live"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
          >
            <i className="fas fa-video mr-2" />
            {t('hero.cta.watch')}
          </a>
        </div>
      </div>

      {/* Small dev-only toggle to switch backgrounds quickly */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur text-white text-xs rounded-md px-2 py-1 space-x-2">
          <span>Hero BG:</span>
          <a className="underline hover:no-underline" href="/?bg=procession">procession</a>
          <a className="underline hover:no-underline" href="/?bg=sanctuary">sanctuary</a>
        </div>
      )}
    </header>
  );
};

export default Hero;
