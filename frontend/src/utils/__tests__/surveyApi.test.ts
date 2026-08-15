import { submitSurveyResponse, fetchSurveyReport } from '../surveyApi';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

describe('submitSurveyResponse', () => {
  it('posts the payload and resolves on 201', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: { q1: 'age18to28' }
    })).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/survey/responses'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the server responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: {}
    })).rejects.toThrow();
  });
});

describe('fetchSurveyReport', () => {
  it('sends the bearer token and returns parsed report data', async () => {
    const data = { totalResponses: 3, questionTallies: { q1: { age18to28: 2 } }, freeTextAnswers: { q7: ['ok'] } };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data }) }) as any;

    const result = await fetchSurveyReport('token123', 'church-services-assessment-2026');
    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/survey/report?survey_slug=church-services-assessment-2026'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token123' }) })
    );
  });
});
