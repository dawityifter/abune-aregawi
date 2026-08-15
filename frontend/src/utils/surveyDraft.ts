import { SURVEY_SLUG } from '../components/survey/surveyDefinitions';

const DRAFT_KEY = `survey.${SURVEY_SLUG}.draft`;

export interface SurveyDraft {
  answers: Record<string, string | string[]>;
  otherTexts: Record<string, string>;
  sectionIndex: number;
}

export function loadDraft(): SurveyDraft | null {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SurveyDraft): void {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  window.localStorage.removeItem(DRAFT_KEY);
}
