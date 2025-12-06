import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

const WhatsHappeningSection: React.FC = () => {
  const { t } = useI18n();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('sections.announcements.title')}</h2>
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Featured Events */}
            <div className="content-card">
              <h3 className="text-h4 font-serif text-primary-700 mb-4">
                <i className="fas fa-bullhorn mr-2"></i>
                {t('sections.announcements.community.title')}
              </h3>
              <p className="text-accent-700 mb-4">
                {t('sections.announcements.community.desc')}
              </p>
              <button className="btn btn-primary btn-small">
                {t('common.cta.learnMore')}
              </button>
            </div>
            <div className="content-card">
              <h3 className="text-h4 font-serif text-primary-700 mb-4">
                <i className="fas fa-book-open mr-2"></i>
                {t('sections.announcements.teachings.title')}
              </h3>
              <p className="text-accent-700 mb-4">
                {t('sections.announcements.teachings.desc')}
              </p>
              <button className="btn btn-primary btn-small">
                {t('common.cta.readMore')}
              </button>
            </div>
            <div className="content-card">
              <h3 className="text-h4 font-serif text-primary-700 mb-4">
                <i className="fas fa-festival mr-2"></i>
                {t('sections.announcements.culture.title')}
              </h3>
              <p className="text-accent-700 mb-4">
                {t('sections.announcements.culture.desc')}
              </p>
              <button className="btn btn-primary btn-small">
                {t('common.cta.getDetails')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatsHappeningSection; 