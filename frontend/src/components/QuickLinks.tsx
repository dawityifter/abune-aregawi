import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

type CardProps = { icon: string; title: string; desc: React.ReactNode; to?: string; external?: boolean };
// Update Card to be full height
const Card: React.FC<CardProps>
  = ({ icon, title, desc, to, external }) => {
    const content = (
      <div className="card border-accent-200 hover:border-accent-300 h-full flex flex-col">
        <div className="flex items-start space-x-4 flex-grow">
          <div className="text-2xl text-primary-700 flex-shrink-0 mt-1">
            <i className={icon} />
          </div>
          <div className="flex-grow w-full">
            <h3 className="text-lg font-semibold text-accent-900">{title}</h3>
            <div className="mt-1 text-sm text-accent-700 leading-relaxed w-full">
              {desc}
            </div>
          </div>
        </div>
      </div>
    );
    if (to && external) {
      return (
        <a href={to} target="_blank" rel="noreferrer" className="block h-full">{content}</a>
      );
    }
    if (to) {
      return (
        <Link to={to} className="block h-full">{content}</Link>
      );
    }
    return content;
  };

const QuickLinks: React.FC = () => {
  const { t } = useLanguage();
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:order-2 h-full">
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
                  <div className="text-base font-bold text-accent-900">{t('priest.name')}</div>
                </div>
              </div>
            )}
            to="#priest"
          />
        </div>
        <div className="lg:order-1 h-full">
          <Card
            icon="fas fa-clock"
            title={t('quicklinks.serviceTimes') || "Service Times"}
            desc={(
              <div className="text-sm text-accent-700 space-y-4">

                {/* Friday Schedule */}
                <div>
                  <div className="flex items-center gap-2 font-semibold text-accent-900 mb-2">
                    <i className="far fa-calendar-alt text-primary-600"></i>
                    {t('friday') || 'Friday'}
                  </div>
                  <ul className="list-none space-y-2 pl-1">
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center"><i className="fas fa-plus-square"></i></div>
                      <div className="flex-1">
                        <strong>Abnet Class:</strong> 6:00 PM - 8:00 PM
                        <ul className="list-none mt-1 space-y-1">
                          <li className="flex items-center gap-2 text-xs text-accent-600">
                            <i className="fas fa-check text-green-500 text-[10px] w-4 text-center"></i>
                            <span>Kidase Class: 6:00 PM - 7:00 PM</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs text-accent-600">
                            <i className="fas fa-check text-green-500 text-[10px] w-4 text-center"></i>
                            <span>Geez Fidel Class: 7:00 PM - 7:45 PM</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs text-accent-600">
                            <i className="fas fa-check text-green-500 text-[10px] w-4 text-center"></i>
                            <span>Mezmur Practice: 7:45 PM - 8:00 PM</span>
                          </li>
                        </ul>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center"><i className="fas fa-broom"></i></div>
                      <span><strong>Church Cleaning:</strong> 6:00 PM - 8:00 PM</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center"><i className="fas fa-music"></i></div>
                      <span><strong>Youth & Adult Mezmur:</strong> 8:00 PM - 9:00 PM</span>
                    </li>
                  </ul>
                </div>

                {/* Sunday Schedule */}
                <div>
                  <div className="flex items-center gap-2 font-semibold text-accent-900 mb-2">
                    <i className="far fa-calendar-alt text-primary-600"></i>
                    {t('sunday') || 'Sunday'}
                  </div>
                  <ul className="list-none space-y-2 pl-1">
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center"><i className="fas fa-praying-hands"></i></div>
                      <span><strong>{t('morning.prayers') || 'Morning Prayers'}:</strong> 3:00 AM</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center"><i className="fas fa-church"></i></div>
                      <span><strong>{t('divine.liturgy') || 'Kidase/Divine Liturgy'}:</strong> 6:00 AM</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center">
                        <span className="flex text-[10px] space-x-0.5">
                          <i className="fas fa-child"></i><i className="fas fa-child text-pink-500"></i>
                        </span>
                      </div>
                      <span><strong>Kids & Youth Class:</strong> 9:30 AM - 11:30 AM</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1 text-accent-600 w-5 flex justify-center"><i className="fas fa-church"></i></div>
                      <span><strong>Sunday School:</strong> 11:30 AM - 12:30 PM</span>
                    </li>
                  </ul>
                </div>

                {/* Notices */}
                <div className="mt-4 pt-3 border-t border-accent-200 text-xs">
                  <p className="italic text-amber-600 mb-2 flex items-center gap-2">
                    <i className="far fa-clock"></i>
                    Times may vary depending on church service.
                  </p>
                  <p className="font-semibold text-primary-700 flex items-center justify-center gap-2 bg-primary-50 py-2 rounded">
                    <i className="fas fa-praying-hands text-primary-600"></i>
                    All are welcome to Join!
                  </p>
                </div>
              </div>
            )}
            to="#worship-times"
          />
        </div>
        <div className="lg:order-3 h-full">
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
      </div>
    </section>
  );
};

export default QuickLinks;
