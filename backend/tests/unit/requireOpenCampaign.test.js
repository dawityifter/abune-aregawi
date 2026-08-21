const express = require('express');
const request = require('supertest');
const requireOpenCampaign = require('../../src/middleware/requireOpenCampaign');
const { Pledge, PledgeCampaign, sequelize } = require('../../src/models');

describe('requireOpenCampaign', () => {
  let openCampaign, closedCampaign, openPledge, closedPledge, app;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();

    app = express();
    app.use(express.json());
    app.post('/body', requireOpenCampaign(requireOpenCampaign.fromBody),
      (req, res) => res.json({ ok: true }));
    app.post('/pledge/:id', requireOpenCampaign(requireOpenCampaign.fromPledgeParam),
      (req, res) => res.json({ ok: true }));
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    openCampaign = await PledgeCampaign.create({
      slug: 'open', name: 'Open', start_date: '2026-01-01', status: 'active'
    });
    closedCampaign = await PledgeCampaign.create({
      slug: 'closed', name: 'Closed', start_date: '2025-09-13', status: 'closed'
    });
    const base = { amount: 100, first_name: 'A', last_name: 'B', pledge_type: 'fundraising' };
    openPledge = await Pledge.create({ ...base, campaign_id: openCampaign.id });
    closedPledge = await Pledge.create({ ...base, campaign_id: closedCampaign.id, is_historical: true });
  });

  it('allows a write to an open campaign via body', async () => {
    const res = await request(app).post('/body').send({ campaign_id: openCampaign.id });
    expect(res.status).toBe(200);
  });

  it('blocks a write to a closed campaign via body', async () => {
    const res = await request(app).post('/body').send({ campaign_id: closedCampaign.id });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('allows a write to a pledge in an open campaign', async () => {
    const res = await request(app).post(`/pledge/${openPledge.id}`).send({});
    expect(res.status).toBe(200);
  });

  it('blocks a write to a 2025 pledge', async () => {
    const res = await request(app).post(`/pledge/${closedPledge.id}`).send({});
    expect(res.status).toBe(409);
  });

  it('passes through when no campaign can be resolved', async () => {
    const res = await request(app).post('/body').send({});
    expect(res.status).toBe(200);
  });
});
