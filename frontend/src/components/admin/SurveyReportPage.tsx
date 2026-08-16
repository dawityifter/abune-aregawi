import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchSurveyReport, SurveyReportData } from '../../utils/surveyApi';
import { SURVEY_QUESTIONS, SURVEY_SLUG } from '../survey/surveyDefinitions';

// Must stay in sync with backend/src/routes/surveyRoutes.js's authorize() list.
// 'church_leadership' is this system's board-equivalent leadership role (see
// AdminDashboard.tsx); there is no 'board' role in the Member role ENUM.
const ALLOWED_ROLES = ['admin', 'secretary', 'church_leadership'];

// Mirrors MEMBER_STATUS_OPTIONS in
// backend/src/config/surveyDefinitions/churchServicesAssessment2026.js.
const MEMBER_STATUS_KEYS = ['firstTimeGuest', 'newMember', 'existingMember'];
const LOCALE_KEYS = ['en', 'ti'];

// Same bar markup the per-question tallies use, so the respondent-profile
// breakdowns read as part of the same report rather than a bolted-on section.
const TallyBars: React.FC<{
  entries: { key: string; label: string; count: number }[];
  denominator: number;
}> = ({ entries, denominator }) => (
  <>
    {entries.map(({ key, label, count }) => {
      const pct = Math.round((count / (denominator || 1)) * 100);
      return (
        <div key={key} className="mb-1">
          <div className="flex justify-between text-sm text-accent-700">
            <span>{label}</span>
            <span>{count} ({pct}%)</span>
          </div>
          <div className="w-full bg-accent-100 rounded h-2">
            <div className="bg-primary-600 h-2 rounded" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    })}
  </>
);

const SurveyReportPage: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [userRoles, setUserRoles] = useState<string[] | null>(null);
  const [report, setReport] = useState<SurveyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleLookupFailed, setRoleLookupFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const uid = currentUser.uid || currentUser.id;
      try {
        const profile = await getUserProfile(uid, currentUser.email, currentUser.phoneNumber);
        const memberData = profile?.data?.member || profile;
        const roles: string[] = memberData?.roles || [memberData?.role || 'member'];
        setUserRoles(roles);
      } catch (err) {
        // Without this, a network blip left userRoles null forever: the page
        // showed "Loading report..." indefinitely plus an unhandled rejection.
        // AdminDashboard wraps the identical call the same way. Deny by default
        // (empty roles) and say we couldn't verify access.
        console.error('SurveyReportPage: failed to resolve user roles', err);
        setUserRoles([]);
        setRoleLookupFailed(true);
        setLoading(false);
      }
    };
    load();
  }, [currentUser, getUserProfile]);

  const canAccess = useMemo(
    () => !!userRoles && userRoles.some(r => ALLOWED_ROLES.includes(r)),
    [userRoles]
  );

  useEffect(() => {
    if (userRoles === null) return;
    if (!canAccess) { setLoading(false); return; }

    const load = async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        const data = await fetchSurveyReport(token || '', SURVEY_SLUG);
        setReport(data);
      } catch {
        setError(t('survey.report.loadError'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userRoles, canAccess, firebaseUser, t]);

  if (userRoles === null || loading) {
    return <div className="p-8 text-center text-accent-500">{t('survey.report.loading')}</div>;
  }

  // A failed role lookup means access could not be verified, which is not the
  // same as a confirmed denial — report it as a load failure.
  if (roleLookupFailed) {
    return <div className="p-8 text-center text-red-600">{t('survey.report.loadError')}</div>;
  }

  if (!canAccess) {
    return <div className="p-8 text-center text-red-600">{t('survey.report.accessDenied')}</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (!report || report.totalResponses === 0) {
    return <div className="p-8 text-center text-accent-500">{t('survey.report.noResponsesYet')}</div>;
  }

  // member_status is optional on submission, so its denominator is the number of
  // respondents who supplied one — not every response.
  const memberStatusAnswered = Object.values(report.memberStatusTallies || {})
    .reduce((sum, n) => sum + n, 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-h2 font-serif text-primary-700 mb-4">{t('survey.report.title')}</h1>
      <p className="mb-6"><strong>{t('survey.report.totalResponses')}</strong>: <span>{report.totalResponses}</span></p>

      {/* Who answered, before what they answered: member_status and locale are
          collected on every submission, and the whole point of keeping them is
          being able to read the per-question tallies in light of who responded. */}
      <div className="mb-8">
        <p className="font-medium text-primary-700 mb-1">{t('survey.memberStatus.label')}</p>
        <p className="text-xs text-accent-500 mb-2">
          {t('survey.report.answeredCount', { answered: memberStatusAnswered, total: report.totalResponses })}
        </p>
        <TallyBars
          entries={MEMBER_STATUS_KEYS.map(key => ({
            key,
            label: t(`survey.memberStatus.options.${key}`),
            count: report.memberStatusTallies?.[key] || 0
          }))}
          denominator={memberStatusAnswered}
        />
      </div>

      <div className="mb-8">
        <p className="font-medium text-primary-700 mb-2">{t('survey.report.localeBreakdown')}</p>
        <TallyBars
          entries={LOCALE_KEYS.map(key => ({
            key,
            label: t(`survey.report.locales.${key}`),
            count: report.localeTallies?.[key] || 0
          }))}
          denominator={report.totalResponses}
        />
      </div>

      {SURVEY_QUESTIONS.filter(q => q.type !== 'text').map(q => {
        const tallies = report.questionTallies[q.id] || {};
        // Nothing in this survey is mandatory, so the denominator is the number
        // of people who answered this specific question, not totalResponses.
        const answered = report.answeredCounts?.[q.id] || 0;
        return (
          <div key={q.id} className="mb-6">
            <p className="font-medium text-primary-700 mb-1">{t(`survey.${q.id}.label`)}</p>
            <p className="text-xs text-accent-500 mb-2">
              {t('survey.report.answeredCount', { answered, total: report.totalResponses })}
            </p>
            {(q.optionKeys || []).map(key => {
              const count = tallies[key] || 0;
              const pct = Math.round((count / (answered || 1)) * 100);
              return (
                <div key={key} className="mb-1">
                  <div className="flex justify-between text-sm text-accent-700">
                    <span>{t(`survey.${q.id}.options.${key}`)}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-accent-100 rounded h-2">
                    <div className="bg-primary-600 h-2 rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {SURVEY_QUESTIONS.filter(q => q.type === 'text').map(q => {
        const texts = report.freeTextAnswers[q.id] || [];
        if (texts.length === 0) return null;
        return (
          <div key={q.id} className="mb-6">
            <p className="font-medium text-primary-700 mb-2">{t(`survey.${q.id}.label`)}</p>
            <p className="text-xs text-accent-500 mb-2">{t('survey.report.freeTextAnswers')}</p>
            <ul className="list-disc list-inside space-y-1">
              {texts.map((text, i) => <li key={i} className="text-sm text-accent-700">{text}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default SurveyReportPage;
