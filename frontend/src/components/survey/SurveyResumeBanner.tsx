import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface SurveyResumeBannerProps {
  // Epoch ms the restored draft was last written; absent on drafts saved before
  // the timestamp existed, in which case the banner simply omits the date.
  savedAt?: number;
  onStartOver: () => void;
  onDismiss: () => void;
}

const SurveyResumeBanner: React.FC<SurveyResumeBannerProps> = ({ savedAt, onStartOver, onDismiss }) => {
  const { t, language } = useLanguage();
  const [confirming, setConfirming] = useState(false);

  const savedOn = savedAt
    ? new Date(savedAt).toLocaleDateString(language === 'ti' ? 'am-ET' : 'en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })
    : null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border border-primary-200 bg-primary-50 px-4 py-3" role="status">
      <div className="flex-1">
        <p className="text-sm text-primary-800">
          {savedOn ? t('survey.resume.welcomeBackOn', { date: savedOn }) : t('survey.resume.welcomeBack')}
        </p>
        <button
          type="button"
          className="mt-1 text-sm font-medium text-primary-700 underline"
          onClick={() => (confirming ? onStartOver() : setConfirming(true))}
        >
          {confirming ? t('survey.resume.confirmStartOver') : t('survey.resume.startOver')}
        </button>
      </div>
      <button
        type="button"
        className="text-primary-500 hover:text-primary-700"
        aria-label={t('survey.resume.dismiss')}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
};

export default SurveyResumeBanner;
