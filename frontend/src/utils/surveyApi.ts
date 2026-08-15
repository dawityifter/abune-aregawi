const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export interface SubmitSurveyPayload {
  surveySlug: string;
  locale: 'en' | 'ti';
  memberStatus?: string;
  answers: Record<string, string | string[]>;
}

export async function submitSurveyResponse(payload: SubmitSurveyPayload): Promise<void> {
  const res = await fetch(`${API_URL}/api/survey/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      survey_slug: payload.surveySlug,
      locale: payload.locale,
      member_status: payload.memberStatus,
      answers: payload.answers
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to submit survey response (status ${res.status})`);
  }
}

export interface SurveyReportData {
  totalResponses: number;
  questionTallies: Record<string, Record<string, number>>;
  freeTextAnswers: Record<string, string[]>;
}

export async function fetchSurveyReport(idToken: string, surveySlug: string): Promise<SurveyReportData> {
  const res = await fetch(`${API_URL}/api/survey/report?survey_slug=${encodeURIComponent(surveySlug)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch survey report (status ${res.status})`);
  }

  const body = await res.json();
  return body.data as SurveyReportData;
}
