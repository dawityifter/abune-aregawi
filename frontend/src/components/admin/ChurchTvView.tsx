import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useI18n } from '../../i18n/I18nProvider';
import { useLanguage } from '../../contexts/LanguageContext';
import { englishNameToTigrinya } from '../../utils/nameTransliteration';

interface Announcement { id: string; title: string; description: string; start_date: string; end_date: string; }
interface Member { id: number | string; firstName: string; middleName?: string; lastName: string; familySize?: number; }

interface Props {
  pendingWelcomes: Member[];
  announcements: Announcement[];
  rotationIntervalSeconds: number;
  onIntervalChange: (seconds: number) => void;
}

type Slide = 'announcements' | 'welcomes';

const ChurchTvView: React.FC<Props> = ({ pendingWelcomes, announcements, rotationIntervalSeconds, onIntervalChange }) => {
  const { dict } = useI18n();
  const { language } = useLanguage();
  const od = dict.outreachDashboard;

  const hasAnnouncements = announcements.length > 0;
  const hasWelcomes = pendingWelcomes.length > 0;

  const initialSlide: Slide = hasAnnouncements ? 'announcements' : 'welcomes';
  const [currentSlide, setCurrentSlide] = useState<Slide>(initialSlide);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [intervalInput, setIntervalInput] = useState(String(rotationIntervalSeconds));

  // Reset announcement index when list changes
  useEffect(() => { setAnnouncementIdx(0); }, [announcements]);

  // Main rotation: switch between announcements slide and welcomes slide
  useEffect(() => {
    if (!hasAnnouncements || !hasWelcomes) return; // nothing to rotate
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentSlide(prev => prev === 'announcements' ? 'welcomes' : 'announcements');
        setVisible(true);
      }, 500);
    }, rotationIntervalSeconds * 1000);
    return () => clearInterval(id);
  }, [rotationIntervalSeconds, hasAnnouncements, hasWelcomes]);

  // Within-slide rotation for multiple announcements
  useEffect(() => {
    if (!hasAnnouncements || announcements.length < 2) return;
    const perAnnouncement = Math.max(5, Math.floor(rotationIntervalSeconds / announcements.length));
    const id = setInterval(() => {
      setAnnouncementIdx(prev => (prev + 1) % announcements.length);
    }, perAnnouncement * 1000);
    return () => clearInterval(id);
  }, [announcements, rotationIntervalSeconds, hasAnnouncements]);

  const handleIntervalSave = () => {
    const v = parseInt(intervalInput, 10);
    if (v >= 5 && v <= 300) { onIntervalChange(v); setSettingsOpen(false); }
  };

  const currentAnnouncement = announcements[announcementIdx];

  const renderAnnouncementsSlide = () => (
    <div className="flex flex-col items-center justify-center h-full px-12 text-center">
      <div className="text-primary-500 text-lg font-medium mb-4 uppercase tracking-widest">
        {od.announcements.tabTitle}
      </div>
      <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">{currentAnnouncement?.title}</h2>
      {currentAnnouncement?.description && (
        <div
          className="text-2xl text-gray-700 max-w-3xl prose prose-2xl mx-auto"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentAnnouncement.description) }}
        />
      )}
      {currentAnnouncement && (
        <p className="mt-8 text-lg text-gray-400">
          {currentAnnouncement.start_date} – {currentAnnouncement.end_date}
        </p>
      )}
      {announcements.length > 1 && (
        <div className="flex gap-2 mt-6">
          {announcements.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${i === announcementIdx ? 'bg-primary-600' : 'bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  );

  const renderWelcomesSlide = () => (
    <>
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-primary-800 mb-2">{od.welcomeTitle}</h2>
        <p className="text-xl text-gray-600">{od.welcomeSubtitle}</p>
      </div>
      <div className="flex-1 w-full mx-auto max-w-5xl relative overflow-hidden flex flex-col justify-center items-center bg-gray-50/50 rounded-lg border border-gray-100">
        {pendingWelcomes.length === 0 ? (
          <div className="text-xl text-gray-500">{od.noNewMembers}</div>
        ) : (
          <>
            <style>{`
              @keyframes scroll-up { 0% { top: 100%; } 100% { top: 0; transform: translateY(-100%); } }
              .animate-scroll-up { position: absolute; width: 100%; animation: scroll-up ${Math.max(20, pendingWelcomes.length * 4)}s linear infinite; }
              .animate-scroll-up:hover { animation-play-state: paused; }
            `}</style>
            <div className="animate-scroll-up flex flex-col gap-6 w-full px-4 pt-10 pb-10">
              {pendingWelcomes.map(m => {
                const familySize = m.familySize || 1;
                const nameRaw = `${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`;
                const nameDisplay = language === 'ti' ? englishNameToTigrinya(nameRaw) : nameRaw;
                const display = familySize > 1 ? `${nameDisplay} ${od.andFamily} (${familySize})` : nameDisplay;
                return (
                  <div key={m.id} className="bg-white rounded-lg p-6 border-l-4 border-primary-600 flex items-center justify-center text-center shadow-sm w-full mx-auto max-w-3xl">
                    <span className="text-3xl font-medium text-gray-900">{display}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200 text-center z-10 bg-white">
        <p className="text-2xl font-semibold text-primary-900">{od.tvFooterMessage}</p>
      </div>
    </>
  );

  const renderEmpty = () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-2xl text-gray-400">{od.noNewMembers}</p>
    </div>
  );

  return (
    <div className="bg-white shadow-sm rounded-xl p-8 border flex flex-col h-[75vh] relative">
      {/* Settings gear */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={() => setSettingsOpen(o => !o)} className="p-2 rounded-full hover:bg-gray-100" title={od.tvSettings.gearLabel}>
          <i className="fas fa-cog text-gray-500"></i>
        </button>
        {settingsOpen && (
          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg p-4 w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">{od.tvSettings.intervalLabel}</label>
            <div className="flex gap-2">
              <input type="number" min={5} max={300} value={intervalInput}
                onChange={e => setIntervalInput(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <button onClick={handleIntervalSave} className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">
                {od.tvSettings.saveLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide content */}
      <div className={`flex-1 flex flex-col transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        {!hasAnnouncements && !hasWelcomes
          ? renderEmpty()
          : currentSlide === 'announcements' && hasAnnouncements
            ? renderAnnouncementsSlide()
            : hasWelcomes
              ? renderWelcomesSlide()
              : renderAnnouncementsSlide()
        }
      </div>
    </div>
  );
};

export default ChurchTvView;
