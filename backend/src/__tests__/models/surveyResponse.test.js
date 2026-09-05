process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, SurveyResponse } = require('../../models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

describe('SurveyResponse model', () => {
  it('creates a response with a generated UUID id and defaulted submitted_at', async () => {
    const row = await SurveyResponse.create({
      survey_slug: 'church-services-assessment-2026',
      locale: 'en',
      answers: { q1: 'age18to28' }
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.submitted_at).toBeInstanceOf(Date);
    expect(row.answers).toEqual({ q1: 'age18to28' });
    expect(row.member_status).toBeNull();
  });

  it('rejects a row with no answers', async () => {
    await expect(
      SurveyResponse.create({ survey_slug: 'church-services-assessment-2026', locale: 'en' })
    ).rejects.toThrow();
  });
});
