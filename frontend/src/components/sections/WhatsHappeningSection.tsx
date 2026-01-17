import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

const WhatsHappeningSection: React.FC = () => {
  const { t } = useI18n();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const announcementImage = `${process.env.PUBLIC_URL || ''}/images/sunday_school/sundayschool1.png`;
  const epiphanyImage = `${process.env.PUBLIC_URL || ''}/images/ephephany.jpeg`;

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('sections.announcements.title')}</h2>
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Announcement Card - Temporary replacement for Community Support Initiatives */}
            <div
              className="content-card flex flex-col items-center justify-center p-0 overflow-hidden cursor-pointer group relative h-full"
              onClick={() => setSelectedImage(announcementImage)}
            >
              <img
                src={announcementImage}
                alt="Sunday School Announcement"
                className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <i className="fas fa-search-plus text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </div>
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

            {/* Epiphany Celebration Image */}
            <div
              className="content-card flex flex-col items-center justify-center p-0 overflow-hidden cursor-pointer group relative h-full"
              onClick={() => setSelectedImage(epiphanyImage)}
            >
              <img
                src={epiphanyImage}
                alt="Epiphany Celebration"
                className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <i className="fas fa-search-plus text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-6 right-6 text-white text-3xl hover:text-gray-300 transition-colors z-[110]"
            onClick={() => setSelectedImage(null)}
          >
            <i className="fas fa-times"></i>
          </button>
          <img
            src={selectedImage}
            alt="Enlarged Christmas Flyer"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};

export default WhatsHappeningSection;
