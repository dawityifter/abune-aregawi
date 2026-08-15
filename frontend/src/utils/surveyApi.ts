const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// The API answers errors with { success: false, message }. Without reading it the
// caller only ever sees the status code, so specific, actionable reasons
// ("Submission too large", the rate-limit message) never reach the respondent.
async function errorFromResponse(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json();
    if (body && typeof body.message === 'string' && body.message.trim()) {
      return new Error(body.message);
    }
  } catch {
    // Not JSON (proxy error page, empty body) — fall through to the generic message.
  }
  return new Error(fallback);
}

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
    throw await errorFromResponse(res, `Failed to submit survey response (status ${res.status})`);
  }
}

export interface SurveyReportData {
  totalResponses: number;
  // Per-question count of responses that answered that question at all. No
  // question is mandatory, so this — not totalResponses — is the denominator
  // for each option's percentage.
  answeredCounts: Record<string, number>;
  questionTallies: Record<string, Record<string, number>>;
  freeTextAnswers: Record<string, string[]>;
}

export async function fetchSurveyReport(idToken: string, surveySlug: string): Promise<SurveyReportData> {
  const res = await fetch(`${API_URL}/api/survey/report?survey_slug=${encodeURIComponent(surveySlug)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (!res.ok) {
    throw await errorFromResponse(res, `Failed to fetch survey report (status ${res.status})`);
  }

  const body = await res.json();
  return body.data as SurveyReportData;
}
