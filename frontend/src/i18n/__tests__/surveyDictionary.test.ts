import { en, ti } from '../dictionaries';
import { SURVEY_QUESTIONS } from '../../components/survey/surveyDefinitions';

describe('survey i18n coverage', () => {
  it.each(SURVEY_QUESTIONS)('$id has an en and ti label', (q) => {
    expect((en as any).survey[q.id]?.label).toEqual(expect.any(String));
    expect((ti as any).survey[q.id]?.label).toEqual(expect.any(String));
  });

  it.each(SURVEY_QUESTIONS.filter(q => q.optionKeys))('$id has en and ti text for every option', (q) => {
    q.optionKeys!.forEach(key => {
      expect((en as any).survey[q.id].options[key]).toEqual(expect.any(String));
      expect((ti as any).survey[q.id].options[key]).toEqual(expect.any(String));
    });
  });

  it('has en and ti section titles for sections 1 through 11', () => {
    for (let i = 1; i <= 11; i++) {
      expect((en as any).survey[`section${i}`].title).toEqual(expect.any(String));
      expect((ti as any).survey[`section${i}`].title).toEqual(expect.any(String));
    }
  });

  it('has en and ti member status options', () => {
    ['firstTimeGuest', 'newMember', 'existingMember'].forEach(key => {
      expect((en as any).survey.memberStatus.options[key]).toEqual(expect.any(String));
      expect((ti as any).survey.memberStatus.options[key]).toEqual(expect.any(String));
    });
  });
});
