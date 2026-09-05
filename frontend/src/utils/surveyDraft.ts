import { SURVEY_SLUG } from '../components/survey/surveyDefinitions';

const DRAFT_KEY = `survey.${SURVEY_SLUG}.draft`;

// How long an unfinished survey is worth resuming. Someone who walked away a
// month ago has moved on; silently dropping them back into a half-finished
// survey is worse than letting them start clean.
export const DRAFT_TTL_DAYS = 30;
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface SurveyDraft {
  answers: Record<string, string | string[]>;
  otherTexts: Record<string, string>;
  sectionIndex: number;
  // The member-status radio only renders on section 1, so if it isn't part of
  // the draft a reload past that section loses the answer with no way to
  // re-enter it.
  memberStatus?: string;
}

export interface StoredSurveyDraft extends SurveyDraft {
  // Stamped by saveDraft, not supplied by callers. Optional because drafts
  // written before this field existed are still readable — they just have no
  // age to judge, so they never expire.
  savedAt?: number;
}

export function loadDraft(): StoredSurveyDraft | null {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  let draft: StoredSurveyDraft;
  try {
    draft = JSON.parse(raw) as StoredSurveyDraft;
  } catch {
    return null;
  }
  if (typeof draft.savedAt === 'number' && Date.now() - draft.savedAt > DRAFT_TTL_MS) {
    clearDraft();
    return null;
  }
  return draft;
}

export function saveDraft(draft: SurveyDraft): void {
  const stored: StoredSurveyDraft = { ...draft, savedAt: Date.now() };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
}

export function clearDraft(): void {
  window.localStorage.removeItem(DRAFT_KEY);
}
