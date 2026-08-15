import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const SurveyThankYou: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="text-center py-12 px-4">
      <h1 className="text-h2 font-serif text-primary-700 mb-4">{t('survey.thankYou.title')}</h1>
      <p className="text-accent-700 mb-2">{t('survey.thankYou.body')}</p>
      <p className="text-accent-700">{t('survey.thankYou.gratitude')}</p>
    </div>
  );
};

export default SurveyThankYou;
