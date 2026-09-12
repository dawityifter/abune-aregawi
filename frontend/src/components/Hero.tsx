import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import AksumCross from './common/AksumCross';

/**
 * The parish's front door.
 *
 * Two things it must do that the previous version did not:
 *
 * 1. Say whose church this is. The old hero carried no name, no city and no
 *    mark — a visitor sent the link learned the parish's identity nowhere
 *    above the fold, because the header hides the name below `sm`.
 * 2. Express an opinion about what to do next. Three identically-styled amber
 *    buttons (Give / YouTube / WhatsApp) said all three were equally the
 *    point. Giving is the point; the other two are links.
 *
 * The background image is fixed. It used to be picked with `Math.random()`,
 * one visit in five showing a different photograph, which meant the front door
 * was never the same twice and the scrim could not be tuned to the image.
 */

// The parish name in both scripts. This is a proper noun, not UI copy: the
// name does not change with the language setting, only which script leads. So
// it lives here rather than in the dictionaries, and both are always shown —
// the parish is both, rather than English with a translation available.
const NAME_LATIN = 'Debre Tsehay Abune Aregawi';
const NAME_GEEZ = 'ደብረ ጸሓይ ኣቡነ ኣረጋዊ';

const HERO_IMAGE = '/images/hero-procession.jpg';

const Hero: React.FC = () => {
  const { lang, t } = useI18n();
  const geezLeads = lang === 'ti';

  return (
    <header id="service-times" className="relative overflow-hidden bg-accent-700 text-white">
      <img
        src={`${process.env.PUBLIC_URL || ''}${HERO_IMAGE}`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: 'center 35%' }}
        fetchPriority="high"
        decoding="async"
      />
      {/* A gradient scrim rather than a flat 40% wash: the type sits at the
          bottom, so that is where the ink needs to be opaque, and the top of
          the photograph stays visible instead of being greyed out uniformly. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-accent-700 via-accent-700/80 to-accent-700/30"
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 pt-24 pb-12 sm:pt-32 sm:pb-16">
        <AksumCross className="h-10 w-auto text-secondary-400 mb-6" />

        <h1 className="font-serif font-bold leading-tight">
          <span className={`block text-3xl sm:text-4xl lg:text-5xl ${geezLeads ? 'text-tigrigna' : ''}`}>
            {geezLeads ? NAME_GEEZ : NAME_LATIN}
          </span>
          <span
            className={`mt-2 block text-lg sm:text-xl font-semibold text-secondary-300 ${geezLeads ? '' : 'text-tigrigna'}`}
          >
            {geezLeads ? NAME_LATIN : NAME_GEEZ}
          </span>
        </h1>

        <p className="mt-3 text-base sm:text-lg text-white/85">
          {t('hero.parishKind')} <span aria-hidden="true">·</span> {t('hero.location')}
        </p>

        <p className="mt-6 max-w-2xl text-base sm:text-lg text-white/90 leading-relaxed">
          {t('hero.mission')}
        </p>

        {/* One decided action, two offered. */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <Link to="/donate" className="btn btn-primary w-full sm:w-auto">
            {t('hero.cta.give')}
          </Link>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href="https://www.youtube.com/channel/UCvK6pJUKU2pvoX7bQ3PN2aA"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white/90 underline underline-offset-4 hover:text-white"
            >
              {t('hero.cta.viewChannel')}
            </a>
            <a
              href="https://chat.whatsapp.com/H3p98BGvP4172pzuqyZKZh"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white/90 underline underline-offset-4 hover:text-white"
            >
              {t('hero.cta.whatsapp')}
            </a>
          </div>
        </div>
      </div>

      {/* Tibeb — the woven band at the edge of a netela. A divider that happens
          to be cultural, rather than an ornament. */}
      <div className="tibeb-band relative" aria-hidden="true" />
    </header>
  );
};

export default Hero;
