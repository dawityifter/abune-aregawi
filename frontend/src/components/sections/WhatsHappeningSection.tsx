import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

// The teaching is authored as PowerPoint, which browsers cannot render. A PDF
// export sits alongside it and is what gets embedded; the .pptx stays available
// as a download for anyone who wants the original slides.
const DOCS_BASE = `${process.env.PUBLIC_URL || ''}/docs`;
const TEACHING_DOC = 'Raising_Children_Orthodox_Tewahedo_Faith';
const TEACHING_PDF = `${DOCS_BASE}/${TEACHING_DOC}.pdf`;
const TEACHING_PPTX = `${DOCS_BASE}/${TEACHING_DOC}.pptx`;
// Static render of slide 1. A real image keeps the home page light — embedding
// the 2.4MB PDF just to show a preview would not.
const TEACHING_PREVIEW = `${process.env.PUBLIC_URL || ''}/images/teachings/raising-children-preview.jpg`;

const WhatsHappeningSection: React.FC = () => {
  const { t } = useI18n();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showTeachingDoc, setShowTeachingDoc] = useState(false);

  const announcementImage = `${process.env.PUBLIC_URL || ''}/images/sunday_school/sundayschool1.png`;

  // Escape closes whichever overlay is open
  useEffect(() => {
    if (!showTeachingDoc && !selectedImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowTeachingDoc(false);
      setSelectedImage(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showTeachingDoc, selectedImage]);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title">{t('sections.announcements.title')}</h2>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
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

              {/* Slide 1 preview — same click target as Read More */}
              <button
                type="button"
                onClick={() => setShowTeachingDoc(true)}
                aria-label={t('sections.announcements.teachings.title')}
                className="group relative mb-4 block aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {/* Slides are 16:9; reserving the ratio stops the card jumping
                    when the lazily-loaded image arrives. */}
                <img
                  src={TEACHING_PREVIEW}
                  alt={t('sections.announcements.teachings.title')}
                  loading="lazy"
                  width={1200}
                  height={675}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                  <i className="fas fa-expand text-2xl text-white opacity-0 transition-opacity group-hover:opacity-100"></i>
                </span>
              </button>

              <button
                className="btn btn-primary btn-small"
                onClick={() => setShowTeachingDoc(true)}
              >
                {t('common.cta.readMore')}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Teaching document viewer */}
      {showTeachingDoc && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col p-3 md:p-8 animate-in fade-in duration-300"
          onClick={() => setShowTeachingDoc(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('sections.announcements.teachings.title')}
        >
          <div
            className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">
                {t('sections.announcements.teachings.title')}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={TEACHING_PDF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('docViewer.openInNewTab')}
                </a>
                <a
                  href={TEACHING_PPTX}
                  download
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('docViewer.download')}
                </a>
                <button
                  onClick={() => setShowTeachingDoc(false)}
                  aria-label={t('docViewer.close')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* iOS Safari renders embedded PDFs unreliably, so the links above
                are the documented escape hatch rather than a hidden fallback. */}
            <iframe
              src={TEACHING_PDF}
              title={t('sections.announcements.teachings.title')}
              className="w-full flex-1 border-0 bg-slate-100"
            />

            <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
              {t('docViewer.unavailable')}
            </p>
          </div>
        </div>
      )}

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
