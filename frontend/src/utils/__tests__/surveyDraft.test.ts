import { loadDraft, saveDraft, clearDraft } from '../surveyDraft';

describe('surveyDraft', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns null when nothing is saved', () => {
    expect(loadDraft()).toBeNull();
  });

  it('round-trips a saved draft', () => {
    saveDraft({ answers: { q1: 'age18to28', q4: ['other'] }, otherTexts: { q4Other: 'x' }, sectionIndex: 2 });
    expect(loadDraft()).toMatchObject({ answers: { q1: 'age18to28', q4: ['other'] }, otherTexts: { q4Other: 'x' }, sectionIndex: 2 });
  });

  it('round-trips memberStatus, which only renders on section 1', () => {
    saveDraft({ answers: {}, otherTexts: {}, sectionIndex: 5, memberStatus: 'newMember' });
    expect(loadDraft()?.memberStatus).toBe('newMember');
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

  describe('expiry', () => {
    const DRAFT_KEY = 'survey.church-services-assessment-2026.draft';
    const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;

    const writeRawDraft = (draft: Record<string, unknown>) =>
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    it('stamps savedAt so an abandoned draft can be aged out', () => {
      const before = Date.now();
      saveDraft({ answers: { q2: 'male' }, otherTexts: {}, sectionIndex: 0 });
      const savedAt = loadDraft()?.savedAt as number;
      expect(savedAt).toBeGreaterThanOrEqual(before);
      expect(savedAt).toBeLessThanOrEqual(Date.now());
    });

    it('discards a draft older than 30 days', () => {
      writeRawDraft({ answers: { q2: 'male' }, otherTexts: {}, sectionIndex: 3, savedAt: daysAgo(31) });
      expect(loadDraft()).toBeNull();
    });

    it('clears the expired draft from storage rather than leaving it to be re-read', () => {
      writeRawDraft({ answers: { q2: 'male' }, otherTexts: {}, sectionIndex: 3, savedAt: daysAgo(31) });
      loadDraft();
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('keeps a draft saved 29 days ago', () => {
      writeRawDraft({ answers: { q2: 'male' }, otherTexts: {}, sectionIndex: 3, savedAt: daysAgo(29) });
      expect(loadDraft()?.answers).toEqual({ q2: 'male' });
    });

    it('keeps a draft written before savedAt existed, since it has no age to judge', () => {
      writeRawDraft({ answers: { q2: 'male' }, otherTexts: {}, sectionIndex: 3 });
      expect(loadDraft()?.answers).toEqual({ q2: 'male' });
    });
  });
});
