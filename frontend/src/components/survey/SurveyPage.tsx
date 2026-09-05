import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import SurveyWizard from './SurveyWizard';
import SurveyThankYou from './SurveyThankYou';
import SurveyResumeBanner from './SurveyResumeBanner';
import { SURVEY_SLUG, SURVEY_SECTION_COUNT, SURVEY_QUESTIONS } from './surveyDefinitions';
import { loadDraft, saveDraft, clearDraft, StoredSurveyDraft } from '../../utils/surveyDraft';
import { submitSurveyResponse } from '../../utils/surveyApi';

// A draft written by merely opening the survey holds nothing worth announcing.
const hasProgress = (draft: StoredSurveyDraft): boolean =>
  Object.keys(draft.answers || {}).length > 0 ||
  Boolean(draft.memberStatus) ||
  draft.sectionIndex > 0;

const SurveyPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [memberStatus, setMemberStatus] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set only when a returning respondent actually had progress restored, so the
  // welcome-back banner never greets a first-time visitor.
  const [resumed, setResumed] = useState<{ savedAt?: number } | null>(null);
  // Both effects below run on the first commit. Without this gate the save
  // effect writes the component's initial, empty state over a real saved
  // draft before the restored values land — and any re-read in between (as
  // StrictMode does) then restores that blank.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setAnswers(draft.answers);
      setOtherTexts(draft.otherTexts);
      setSectionIndex(draft.sectionIndex);
      setMemberStatus(draft.memberStatus);
      if (hasProgress(draft)) setResumed({ savedAt: draft.savedAt });
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored && !submitted) {
      saveDraft({ answers, otherTexts, sectionIndex, memberStatus });
    }
  }, [restored, answers, otherTexts, sectionIndex, memberStatus, submitted]);

  const handleAnswerChange = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const handleOtherChange = (id: string, text: string) => {
    setOtherTexts(prev => ({ ...prev, [`${id}Other`]: text }));
  };

  const buildSubmissionAnswers = (): Record<string, string | string[]> => {
    const merged: Record<string, string | string[]> = { ...answers };
    SURVEY_QUESTIONS.forEach(q => {
      if (!q.otherOptionKey) return;
      const key = `${q.id}Other`;
      const text = otherTexts[key];
      if (!text) return;
      const currentValue = answers[q.id];
      const isOtherSelected = q.type === 'single'
        ? currentValue === q.otherOptionKey
        : Array.isArray(currentValue) && currentValue.includes(q.otherOptionKey);
      if (isOtherSelected) merged[key] = text;
    });
    return merged;
  };

  const handleStartOver = () => {
    clearDraft();
    setAnswers({});
    setOtherTexts({});
    setMemberStatus(undefined);
    setSectionIndex(0);
    setSubmitError(null);
    setResumed(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitSurveyResponse({
        surveySlug: SURVEY_SLUG,
        locale: language as 'en' | 'ti',
        memberStatus,
        answers: buildSubmissionAnswers()
      });
      clearDraft();
      setSubmitted(true);
    } catch (err) {
      // Prefer the server's own reason ("Submission too large", the rate-limit
      // message) over the generic string — it is the only thing that tells the
      // respondent what to actually do differently.
      const message = err instanceof Error ? err.message.trim() : '';
      setSubmitError(message || t('survey.wizard.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <SurveyThankYou />;

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        {resumed && (
          <SurveyResumeBanner
            savedAt={resumed.savedAt}
            onStartOver={handleStartOver}
            onDismiss={() => setResumed(null)}
          />
        )}
        <SurveyWizard
          sectionIndex={sectionIndex}
          answers={answers}
          otherTexts={otherTexts}
          memberStatus={memberStatus}
          onAnswerChange={handleAnswerChange}
          onOtherChange={handleOtherChange}
          onMemberStatusChange={setMemberStatus}
          onBack={() => setSectionIndex(i => Math.max(0, i - 1))}
          onNext={() => setSectionIndex(i => Math.min(SURVEY_SECTION_COUNT - 1, i + 1))}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    </div>
  );
};

export default SurveyPage;
