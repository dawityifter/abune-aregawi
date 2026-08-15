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
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => { throw new Error('no body'); } }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: {}
    })).rejects.toThrow('status 429');
  });

  it("surfaces the server's message instead of a bare status code", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ success: false, message: 'Too many survey submissions from this IP, please try again later.' })
    }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: {}
    })).rejects.toThrow('Too many survey submissions from this IP, please try again later.');
  });

  it('falls back to the generic message when the error body is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); }
    }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: {}
    })).rejects.toThrow('Failed to submit survey response (status 502)');
  });

  it('falls back to the generic message when the JSON body has no message field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false })
    }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: {}
    })).rejects.toThrow('Failed to submit survey response (status 400)');
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

  it("surfaces the server's message on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, message: 'Access denied. Insufficient permissions.' })
    }) as any;
    await expect(fetchSurveyReport('token123', 'church-services-assessment-2026'))
      .rejects.toThrow('Access denied. Insufficient permissions.');
  });

  it('falls back to the generic message when the error body is unusable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError('not json'); }
    }) as any;
    await expect(fetchSurveyReport('token123', 'church-services-assessment-2026'))
      .rejects.toThrow('Failed to fetch survey report (status 500)');
  });
});
