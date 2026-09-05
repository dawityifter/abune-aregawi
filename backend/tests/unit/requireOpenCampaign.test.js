const express = require('express');
const request = require('supertest');
const requireOpenCampaign = require('../../src/middleware/requireOpenCampaign');
const {
  Pledge, PledgeCampaign, PledgeAllocation, Transaction, Member, sequelize
} = require('../../src/models');

describe('requireOpenCampaign', () => {
  let openCampaign, closedCampaign, draftCampaign;
  let openPledge, closedPledge;
  let member, openTxn, closedTxn, openAllocation, closedAllocation;
  let app;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();

    app = express();
    app.use(express.json());

    app.post('/body', requireOpenCampaign(requireOpenCampaign.fromBody),
      (req, res) => res.json({ ok: true }));

    app.post('/pledge/:id', requireOpenCampaign(requireOpenCampaign.fromPledgeParam),
      (req, res) => res.json({ ok: true }));

    // Echoes req.campaign back so tests can assert the middleware actually set
    // it (and set it to the right campaign) on the success path — this is the
    // field Task 13's offline-payment endpoint reads.
    app.post('/echo/:id', requireOpenCampaign(requireOpenCampaign.fromPledgeParam),
      (req, res) => res.json({
        ok: true,
        campaignId: req.campaign ? String(req.campaign.id) : null,
        defaultPaymentType: req.campaign ? req.campaign.default_payment_type : null
      }));

    app.post('/allocation/:id', requireOpenCampaign(requireOpenCampaign.fromAllocationParam),
      (req, res) => res.json({ ok: true }));

    // A resolver that throws, to prove errors reach next(err) rather than being
    // swallowed or hanging.
    app.post('/throw', requireOpenCampaign(() => { throw new Error('resolver boom'); }),
      (req, res) => res.json({ ok: true }));

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    openCampaign = await PledgeCampaign.create({
      slug: 'open', name: 'Open', start_date: '2026-01-01', status: 'active',
      default_payment_type: 'pledge_drive'
    });
    closedCampaign = await PledgeCampaign.create({
      slug: 'closed', name: 'Closed', start_date: '2025-09-13', status: 'closed'
    });
    draftCampaign = await PledgeCampaign.create({
      slug: 'draft', name: 'Draft', start_date: '2026-06-01', status: 'draft'
    });

    const base = { amount: 100, first_name: 'A', last_name: 'B', pledge_type: 'fundraising' };
    openPledge = await Pledge.create({ ...base, campaign_id: openCampaign.id });
    closedPledge = await Pledge.create({ ...base, campaign_id: closedCampaign.id, is_historical: true });

    member = await Member.create({
      first_name: 'Test',
      last_name: 'Giver',
      phone_number: '+15550001111',
      email: 'test-giver@example.com', is_active: true, role: 'member', firebase_uid: 'uid-test-giver'
    });

    openTxn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 100, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    closedTxn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2025-10-01',
      amount: 100, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });

    // Created directly against the model (not the allocate() service, which
    // already refuses closed campaigns itself) so the middleware is exercised
    // in isolation, same as the rest of this file.
    openAllocation = await PledgeAllocation.create({
      pledge_id: openPledge.id, transaction_id: openTxn.id, amount: 100,
      source: 'treasurer_manual', allocated_by: member.id
    });
    closedAllocation = await PledgeAllocation.create({
      pledge_id: closedPledge.id, transaction_id: closedTxn.id, amount: 100,
      source: 'migration', allocated_by: member.id
    });
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

  it('sets req.campaign with the resolved id and default_payment_type on success', async () => {
    const res = await request(app).post(`/echo/${openPledge.id}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.campaignId).toBe(String(openCampaign.id));
    expect(res.body.defaultPaymentType).toBe('pledge_drive');
  });

  it('blocks a write to an allocation belonging to a closed-campaign pledge', async () => {
    const res = await request(app).post(`/allocation/${closedAllocation.id}`).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('allows a write to an allocation belonging to an open-campaign pledge', async () => {
    const res = await request(app).post(`/allocation/${openAllocation.id}`).send({});
    expect(res.status).toBe(200);
  });

  it('allows a write to a draft campaign', async () => {
    const res = await request(app).post('/body').send({ campaign_id: draftCampaign.id });
    expect(res.status).toBe(200);
  });

  it('passes a thrown resolver error to the error handler instead of swallowing it', async () => {
    const res = await request(app).post('/throw').send({});
    expect(res.status).toBe(500);
  });
});
