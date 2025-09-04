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
                Community Support Initiatives
              </h3>
              <p className="text-accent-700 mb-4">
                Join us in supporting our community through outreach and charity programs.
              </p>
              <button className="btn btn-primary btn-small">
                Learn More
              </button>
            </div>
            <div className="content-card">
              <h3 className="text-h4 font-serif text-primary-700 mb-4">
                <i className="fas fa-book-open mr-2"></i>
                Tigray Orthodox Faith Teachings
              </h3>
              <p className="text-accent-700 mb-4">
                Explore the rich traditions and teachings of the Tigray Orthodox faith.
              </p>
              <button className="btn btn-primary btn-small">
                Read More
              </button>
            </div>
            <div className="content-card">
              <h3 className="text-h4 font-serif text-primary-700 mb-4">
                <i className="fas fa-festival mr-2"></i>
                Cultural Celebrations
              </h3>
              <p className="text-accent-700 mb-4">
                Experience our heritage through festivals and community gatherings.
              </p>
              <button className="btn btn-primary btn-small">
                Get Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatsHappeningSection; 