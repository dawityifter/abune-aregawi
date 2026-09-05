import { SURVEY_QUESTIONS, SURVEY_SECTION_COUNT, questionsForSection } from '../surveyDefinitions';

describe('surveyDefinitions', () => {
  it('has exactly 56 questions with unique ids', () => {
    expect(SURVEY_QUESTIONS).toHaveLength(56);
    expect(new Set(SURVEY_QUESTIONS.map(q => q.id)).size).toBe(56);
  });

  it('covers sections 1 through 11 with no gaps', () => {
    const sections = new Set(SURVEY_QUESTIONS.map(q => q.section));
    expect(sections).toEqual(new Set(Array.from({ length: SURVEY_SECTION_COUNT }, (_, i) => i + 1)));
  });

  it('every multi/single question has at least 2 optionKeys', () => {
    SURVEY_QUESTIONS
      .filter(q => q.type !== 'text')
      .forEach(q => expect((q.optionKeys || []).length).toBeGreaterThanOrEqual(2));
  });

  it('questionsForSection(1) returns q1 through q7 in order', () => {
    expect(questionsForSection(1).map(q => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
  });
});
