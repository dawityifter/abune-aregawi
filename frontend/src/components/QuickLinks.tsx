import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

type CardProps = { icon: string; title: string; desc: React.ReactNode; to?: string; external?: boolean };
const Card: React.FC<CardProps>
  = ({ icon, title, desc, to, external }) => {
  const content = (
    <div className="card border-accent-200 hover:border-accent-300">
      <div className="flex items-start space-x-4">
        <div className="text-2xl text-primary-700">
          <i className={icon} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-accent-900">{title}</h3>
          <div className="mt-1 text-sm text-accent-700 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  );
  if (to && external) {
    return (
      <a href={to} target="_blank" rel="noreferrer" className="block">{content}</a>
    );
  }
  if (to) {
    return (
      <Link to={to} className="block">{content}</Link>
    );
  }
  return content;
};

const QuickLinks: React.FC = () => {
  const { t } = useLanguage();
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:order-2">
          <Card
          icon="fas fa-church"
          title="Priest"
          desc={(
            <>
              <img
                src={`${process.env.PUBLIC_URL || ''}/keshi-Tadesse.png`}
                alt="Keshi Tadesse"
                className="mt-3 w-full h-auto max-h-64 object-contain rounded-md shadow"
                loading="lazy"
              />
              <div className="mt-3 text-center">
                <div className="text-sm font-semibold text-accent-900">{t('priest.name')}</div>
                <div className="text-xs text-accent-700">{t('priest.title')}</div>
              </div>
            </>
          )}
          to="#priest"
          />
        </div>
        <div className="lg:order-1">
          <Card
          icon="fas fa-clock"
          title="Service Times"
          desc={(
            <>
              <div className="font-semibold text-accent-900 mb-1">{t('sunday') || 'Sunday'}</div>
              <ul className="text-sm text-accent-700 space-y-1 list-disc pl-5">
                <li>
                  <strong>{t('morning.prayers') || 'Morning Prayers'}:</strong> {t('morning.prayers.time') || '6:00 AM'}
                </li>
                <li>
                  <strong>{t('divine.liturgy') || 'Divine Liturgy'}:</strong> {t('divine.liturgy.time') || '8:30 AM'}
                </li>
              </ul>
            </>
          )}
          to="#worship-times"
          />
        </div>
        <div className="lg:order-3">
          <Card
          icon="fas fa-map-marker"
          title="Location"
          desc={(
            <>
              <div className="font-semibold">1621 S Jupiter Rd, Garland, TX 75042</div>
              <a
                href="https://maps.google.com/?q=1621+S+Jupiter+Rd,+Garland,+TX+75042"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 mt-3 text-amber-500 hover:text-amber-600"
              >
                <i className="fas fa-diamond-turn-right text-lg" />
                <span className="font-medium">Get Directions</span>
              </a>
            </>
          )}
          />
        </div>
      </div>
    </section>
  );
};

export default QuickLinks;
