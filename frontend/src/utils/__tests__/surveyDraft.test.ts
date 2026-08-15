import { loadDraft, saveDraft, clearDraft } from '../surveyDraft';

describe('surveyDraft', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns null when nothing is saved', () => {
    expect(loadDraft()).toBeNull();
  });

  it('round-trips a saved draft', () => {
    saveDraft({ answers: { q1: 'age18to28', q4: ['other'] }, otherTexts: { q4Other: 'x' }, sectionIndex: 2 });
    expect(loadDraft()).toEqual({ answers: { q1: 'age18to28', q4: ['other'] }, otherTexts: { q4Other: 'x' }, sectionIndex: 2 });
  });

  it('clearDraft removes the saved draft', () => {
    saveDraft({ answers: { q1: 'male' }, otherTexts: {}, sectionIndex: 0 });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('returns null for corrupted JSON instead of throwing', () => {
    window.localStorage.setItem('survey.church-services-assessment-2026.draft', 'not json');
    expect(loadDraft()).toBeNull();
  });
});
