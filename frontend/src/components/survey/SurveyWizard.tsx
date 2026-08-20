import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import SurveyQuestion from './SurveyQuestion';
import { SURVEY_SECTION_COUNT, questionsForSection } from './surveyDefinitions';

interface SurveyWizardProps {
  sectionIndex: number;
  answers: Record<string, string | string[]>;
  otherTexts: Record<string, string>;
  memberStatus: string | undefined;
  onAnswerChange: (id: string, value: string | string[]) => void;
  onOtherChange: (id: string, text: string) => void;
  onMemberStatusChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}

const SurveyWizard: React.FC<SurveyWizardProps> = ({
  sectionIndex, answers, otherTexts, memberStatus,
  onAnswerChange, onOtherChange, onMemberStatusChange,
  onBack, onNext, onSubmit, submitting, submitError
}) => {
  const { t } = useLanguage();
  const section = sectionIndex + 1;
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === SURVEY_SECTION_COUNT - 1;
  const questions = questionsForSection(section);

  return (
    <div>
      <p className="text-sm text-accent-500 mb-4">
        {t('survey.wizard.sectionProgress', { current: section, total: SURVEY_SECTION_COUNT })}
      </p>

      {isFirst && (
        <div className="mb-6 pb-6 border-b border-accent-200">
          <h1 className="text-h2 font-serif text-primary-700 mb-2">{t('survey.intro.title')}</h1>
          <p className="text-accent-700 mb-2">{t('survey.intro.welcome')}</p>
          <p className="text-xs text-accent-500 mb-4">{t('survey.intro.confidentialityNotice')}</p>
          <p className="font-medium text-primary-700 mb-2">{t('survey.memberStatus.label')}</p>
          <div className="flex flex-wrap gap-4 mb-2">
            {['firstTimeGuest', 'newMember', 'existingMember'].map(key => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="memberStatus"
                  checked={memberStatus === key}
                  onChange={() => onMemberStatusChange(key)}
                />
                {t(`survey.memberStatus.options.${key}`)}
              </label>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-primary-700 mb-1">{t(`survey.section${section}.title`)}</h2>
      <p className="text-sm text-accent-500 mb-4">{t(`survey.section${section}.instruction`)}</p>
      <p className="text-xs text-accent-500 mb-4">{t('survey.wizard.skipHint')}</p>

      {questions.map(q => (
        <SurveyQuestion
          key={q.id}
          question={q}
          value={answers[q.id]}
          otherValue={otherTexts[`${q.id}Other`]}
          onChange={onAnswerChange}
          onOtherChange={onOtherChange}
        />
      ))}

      {submitError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4">{submitError}</div>}

      <div className="flex justify-between mt-6">
        {!isFirst ? (
          <button type="button" className="btn btn-secondary" onClick={onBack}>{t('survey.wizard.back')}</button>
        ) : <span />}
        {isLast ? (
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? t('survey.wizard.submitting') : t('survey.wizard.submit')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onNext}>{t('survey.wizard.next')}</button>
        )}
      </div>

      {/* Sits by the Next button on purpose: this is where someone facing 56
          questions decides whether leaving means losing their answers. */}
      <p className="text-xs text-accent-500 mt-4">{t('survey.wizard.autosaveNotice')}</p>
    </div>
  );
};

export default SurveyWizard;
