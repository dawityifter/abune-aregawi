import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * The parish's priest, near the top of the home page.
 *
 * This was one of four equal cards in the QuickLinks grid at the foot of the
 * page, sitting beside a map and a survey link — and it linked to `#priest`,
 * an anchor that exists nowhere, so the one card a visitor was most likely to
 * tap did nothing. It now stands on its own above the parish's news, carries
 * the id itself, and has room for the bio string that was already written in
 * both languages and never rendered anywhere.
 *
 * Landscape rather than the portrait card it came from: at full width a 3:4
 * image would be a wall of photograph, and the text has to sit beside it.
 */
const ChurchFather: React.FC = () => {
  const { t } = useLanguage();
  const name = t('priest.name');

  return (
    <section id="priest" className="max-w-7xl mx-auto px-4 pt-8">
      <div className="card flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative w-40 flex-shrink-0 self-center overflow-hidden rounded-md shadow sm:self-start aspect-[3/4]">
          <img
            src={`${process.env.PUBLIC_URL || ''}/meleakeTsehay-Tadesse.png`}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading="lazy"
          />
        </div>

        <div className="min-w-0">
          <div className="text-caption font-semibold uppercase tracking-wider text-accent-500">
            {t('priest.title') || 'Our Church Father'}
          </div>
          <div className="mt-1 font-serif text-h3 text-accent-700">{name}</div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-accent-600">
            {t('priest.bio')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ChurchFather;
