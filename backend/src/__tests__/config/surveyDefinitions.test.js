const {
  SURVEY_SLUG,
  SURVEY_DEFINITIONS,
  MEMBER_STATUS_OPTIONS,
  isValidAnswers
} = require('../../config/surveyDefinitions/churchServicesAssessment2026');

describe('churchServicesAssessment2026 survey definitions', () => {
  it('defines exactly 56 questions with unique ids', () => {
    const { questions } = SURVEY_DEFINITIONS[SURVEY_SLUG];
    expect(questions).toHaveLength(56);
    expect(new Set(questions.map(q => q.id)).size).toBe(56);
  });

  it('defines the 3 member status options', () => {
    expect(MEMBER_STATUS_OPTIONS).toEqual(['firstTimeGuest', 'newMember', 'existingMember']);
  });

  it('accepts a valid mixed-type answer payload', () => {
    const result = isValidAnswers(SURVEY_SLUG, {
      q1: 'age18to28',
      q4: ['familyFriendInvitation', 'other'],
      q4Other: 'A friend from work',
      q7: 'Free text answer'
    });
    expect(result).toEqual({ valid: true });
  });

  it('rejects an unknown survey_slug', () => {
    expect(isValidAnswers('not-a-real-slug', {}).valid).toBe(false);
  });

  it('rejects an unknown question id', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q999: 'x' }).valid).toBe(false);
  });

  it('rejects an invalid option for a single-select question', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q1: 'not-a-real-option' }).valid).toBe(false);
  });

  it('rejects a multi-select answer that is not an array', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q4: 'familyFriendInvitation' }).valid).toBe(false);
  });

  it('rejects a multi-select answer exceeding maxSelect', () => {
    expect(isValidAnswers(SURVEY_SLUG, {
      q32: ['soundSystem', 'displayScreens', 'chairsSeating']
    }).valid).toBe(false);
  });

  it('accepts a multi-select answer at exactly maxSelect', () => {
    expect(isValidAnswers(SURVEY_SLUG, {
      q32: ['soundSystem', 'displayScreens']
    })).toEqual({ valid: true });
  });

  it('rejects a non-string text answer', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q7: 123 }).valid).toBe(false);
  });
});
