import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useI18n } from '../i18n/I18nProvider';
import { useActiveCampaign } from '../hooks/useActiveCampaign';

type CardProps = { icon: string; title: string; desc: React.ReactNode; to?: string; external?: boolean };
const Card: React.FC<CardProps>
  = ({ icon, title, desc, to, external }) => {
    const content = (
      <div className="card">
        <div className="flex items-start space-x-4">
          <div className="text-2xl text-primary-700 flex-shrink-0 mt-1">
            <i className={icon} />
          </div>
          <div className="flex-grow w-full">
            <h3 className="text-lg font-semibold text-accent-700">{title}</h3>
            <div className="mt-1 text-sm text-accent-700 leading-relaxed w-full">
              {desc}
            </div>
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
  const { lang } = useI18n();
  const { campaign } = useActiveCampaign();
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <div>
          <Card
            icon="fas fa-church"
            title={t('priest.title') || "Our Church Father"}
            desc={(
              <div className="flex flex-col h-full">
                <div className="relative w-full aspect-[3/4] overflow-hidden rounded-md shadow mt-3">
                  <img
                    src={`${process.env.PUBLIC_URL || ''}/meleakeTsehay-Tadesse.png`}
                    alt="Keshi Tadesse"
                    className="absolute inset-0 w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 text-center">
                  <div className="text-base font-bold text-accent-700">{t('priest.name')}</div>
                </div>
              </div>
            )}
            to="#priest"
          />
        </div>
        <div>
          <Card
            icon="fas fa-map-marker"
            title={t('quicklinks.location') || "Location"}
            desc={(
              <div className="flex flex-col h-full">
                <div className="font-semibold mb-2">1621 S Jupiter Rd, Garland, TX 75042</div>

                <div className="w-full h-64 rounded-md overflow-hidden shadow border border-gray-200 mb-3 flex-grow">
                  <iframe
                    width="100%"
                    height="100%"
                    id="gmap_canvas"
                    src="https://maps.google.com/maps?q=1621+S+Jupiter+Rd,+Garland,+TX+75042&t=&z=15&ie=UTF8&iwloc=&output=embed"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    title="Church Location"
                  ></iframe>
                </div>

                <a
                  href="https://maps.google.com/?q=1621+S+Jupiter+Rd,+Garland,+TX+75042"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 self-start text-amber-500 hover:text-amber-600 mt-auto"
                >
                  <i className="fas fa-diamond-turn-right text-lg" />
                  <span className="font-medium">{t('quicklinks.getDirections') || "Get Directions"}</span>
                </a>
              </div>
            )}
          />
        </div>
        <div>
          <Card
            icon="fas fa-clipboard-list"
            title={t('survey.homeCard.title')}
            desc={t('survey.homeCard.description')}
            to="/survey"
          />
        </div>
        {/* Only while a drive is actually running. Loading and error both
            leave `campaign` null, so the card fails closed rather than
            rendering a broken entry on the parish home page. */}
        {campaign && (
          <div>
            <Card
              icon="fas fa-hand-holding-heart"
              title={(lang === 'ti' && campaign.name_ti) || campaign.name}
              desc={(lang === 'ti' && campaign.description_ti) || campaign.description || t('pledge.homeCard.description')}
              to="/pledge"
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default QuickLinks;
