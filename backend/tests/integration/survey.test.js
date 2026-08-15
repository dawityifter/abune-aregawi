const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { id: 1, role: process.env.TEST_SURVEY_ROLE || 'member', roles: [process.env.TEST_SURVEY_ROLE || 'member'] };
    next();
  }
}));

const app = require('../../src/server');
const { sequelize, SurveyResponse } = require('../../src/models');
const { SURVEY_SLUG } = require('../../src/config/surveyDefinitions/churchServicesAssessment2026');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await SurveyResponse.destroy({ where: {} });
});

// express-rate-limit's default keyGenerator buckets by req.ip. All tests in this
// file share one Express app instance and therefore one limiter store, so each
// test below sets a distinct X-Forwarded-For IP (server.js already has
// `app.set('trust proxy', 1)`) to keep its requests out of every other test's
// bucket. The dedicated rate-limit test uses its own fixed IP across its whole
// sequence, since that's the one test that must actually fill a bucket.
describe('POST /api/survey/responses', () => {
  it('accepts a valid anonymous submission', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({
        survey_slug: SURVEY_SLUG,
        locale: 'en',
        member_status: 'existingMember',
        answers: { q1: 'age18to28', q4: ['familyFriendInvitation'], q7: 'Great parish' }
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const rows = await SurveyResponse.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].member_status).toBe('existingMember');
    expect(rows[0].answers.q1).toBe('age18to28');
    expect(rows[0].ip_hash).toEqual(expect.any(String));
  });

  it('does not require member_status, locale defaults are still validated', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ survey_slug: SURVEY_SLUG, locale: 'ti', answers: { q2: 'female' } });
    expect(res.status).toBe(201);
  });

  it('rejects an unknown survey_slug', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.3')
      .send({ survey_slug: 'bogus', locale: 'en', answers: {} });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid locale', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.4')
      .send({ survey_slug: SURVEY_SLUG, locale: 'fr', answers: {} });
    expect(res.status).toBe(400);
  });

  it('rejects an answer payload with an unknown question id', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.5')
      .send({ survey_slug: SURVEY_SLUG, locale: 'en', answers: { q999: 'x' } });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized answers payload', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.6')
      .send({ survey_slug: SURVEY_SLUG, locale: 'en', answers: { q7: 'x'.repeat(21000) } });
    expect(res.status).toBe(400);
  });

  it('rate-limits after 5 submissions from the same IP within the window', async () => {
    const payload = { survey_slug: SURVEY_SLUG, locale: 'en', answers: { q2: 'male' } };
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/survey/responses')
        .set('X-Forwarded-For', '10.0.0.100')
        .send(payload);
      expect(res.status).toBe(201);
    }
    const sixth = await request(app)
      .post('/api/survey/responses')
      .set('X-Forwarded-For', '10.0.0.100')
      .send(payload);
    expect(sixth.status).toBe(429);
  });
});
