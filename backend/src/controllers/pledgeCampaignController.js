const { PledgeCampaign, CampaignTotal, ActivityLog } = require('../models');
const { Op } = require('sequelize');
const { findLiveCampaign, findOverlappingActive, todayInChurchTz } = require('../services/pledgeCampaignService');

// PUBLIC — powers the unauthenticated pledge form used at events. Select the
// column list explicitly (never the whole model, never joined with
// campaign_totals) so a future column addition can't silently leak financial
// or donor data through this endpoint. See routes file for the auth gate.
const PUBLIC_ATTRIBUTES = [
  'id', 'slug', 'name', 'name_ti', 'description', 'description_ti',
  'start_date', 'end_date', 'goal_amount', 'currency'
];

const listActive = async (req, res) => {
  try {
    // Live means active AND inside the date window — see
    // services/pledgeCampaignService. Exactly one drive runs at a time, so
    // this is 0 or 1 rows; the array shape is kept so existing callers of
    // this endpoint keep working.
    const live = await findLiveCampaign();

    const campaigns = live
      ? [await PledgeCampaign.findByPk(live.id, { attributes: PUBLIC_ATTRIBUTES })]
      : [];

    res.status(200).json({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('Error listing active pledge campaigns:', error);
    // This endpoint is public and unauthenticated — deliberately withhold
    // error.message from the response so internal/DB detail never reaches
    // an anonymous caller. Full detail stays in the server log above.
    res.status(500).json({
      success: false,
      message: 'Failed to load campaigns'
    });
  }
};

// Full listing for staff — may include totals. PledgeCampaign has no
// association to the campaign_totals VIEW (CampaignTotal only belongs-to the
// other way), so totals are fetched separately and merged by campaign id
// rather than joined.
const listAll = async (req, res) => {
  try {
    const [campaigns, totals] = await Promise.all([
      PledgeCampaign.findAll({ order: [['start_date', 'DESC']] }),
      CampaignTotal.findAll()
    ]);

    const totalsByCampaignId = new Map(totals.map((t) => [String(t.campaign_id), t]));

    res.status(200).json({
      success: true,
      campaigns: campaigns.map((campaign) => ({
        ...campaign.toJSON(),
        totals: totalsByCampaignId.get(String(campaign.id)) || null
      }))
    });
  } catch (error) {
    console.error('Error listing pledge campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list pledge campaigns',
      error: error.message
    });
  }
};

// Totals come straight from the campaign_totals VIEW — never recomputed here.
const getTotals = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await PledgeCampaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Pledge campaign not found'
      });
    }

    const totals = await CampaignTotal.findByPk(id);

    res.status(200).json({
      success: true,
      totals
    });
  } catch (error) {
    console.error('Error getting pledge campaign totals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pledge campaign totals',
      error: error.message
    });
  }
};

// Exactly one campaign runs at a time. Checked in the app layer rather than
// with a Postgres EXCLUDE constraint because the test suite runs on SQLite,
// which has no such constraint — the same portability rule that shaped the
// pledge views. Two admins activating in the same instant could still race;
// activation is admin-only and rare, and the result is a visible duplicate
// rather than corrupted money.
const overlapConflict = async ({ id, start_date, end_date }) => {
  const clash = await findOverlappingActive({ id, start_date, end_date });
  if (!clash) return null;
  const window = `${clash.start_date} – ${clash.end_date || 'no end date'}`;
  return {
    success: false,
    code: 'CAMPAIGN_OVERLAP',
    message: `${clash.name} (${window}) is already active for these dates.`
  };
};

const create = async (req, res) => {
  try {
    const {
      slug, name, name_ti, description, description_ti,
      start_date, end_date, goal_amount, currency, status,
      default_payment_type, income_category_id
    } = req.body;

    if (status && !PledgeCampaign.STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${PledgeCampaign.STATUSES.join(', ')}`
      });
    }

    if (status === 'active') {
      const conflict = await overlapConflict({ start_date, end_date });
      if (conflict) return res.status(409).json(conflict);
    }

    const campaign = await PledgeCampaign.create({
      slug,
      name,
      name_ti,
      description,
      description_ti,
      start_date,
      end_date,
      goal_amount,
      currency,
      status,
      default_payment_type,
      income_category_id
    });

    res.status(201).json({
      success: true,
      message: 'Pledge campaign created successfully',
      campaign
    });
  } catch (error) {
    console.error('Error creating pledge campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pledge campaign',
      error: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await PledgeCampaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Pledge campaign not found'
      });
    }

    if (req.body.status !== undefined && !PledgeCampaign.STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${PledgeCampaign.STATUSES.join(', ')}`
      });
    }

    // Capture the OLD status before update() mutates the in-memory instance,
    // otherwise details.from would equal details.to below.
    const previousStatus = campaign.status;

    const updatable = [
      'name', 'name_ti', 'description', 'description_ti', 'start_date',
      'end_date', 'goal_amount', 'currency', 'status', 'default_payment_type',
      'income_category_id'
    ];
    const updateData = {};
    updatable.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    // Check the campaign's post-update state, not just the request body: an
    // admin widening an already-active campaign's dates can swallow another
    // live one without ever sending status='active'.
    const nextStatus = updateData.status ?? campaign.status;
    if (nextStatus === 'active') {
      const conflict = await overlapConflict({
        id: campaign.id,
        start_date: updateData.start_date ?? campaign.start_date,
        end_date: updateData.end_date !== undefined ? updateData.end_date : campaign.end_date
      });
      if (conflict) return res.status(409).json(conflict);
    }

    // A campaign is only *live* when it is active AND today sits inside its
    // window (pledgeCampaignService.isLive). Flipping a finished drive back to
    // 'active' would therefore change the admin list and nothing else: the
    // pledge page would still report no campaign and the header link would
    // stay hidden. Refuse rather than hand back a success that does nothing.
    //
    // Scoped to a transition INTO active, not to any request that leaves the
    // campaign active. An already-active drive whose window has passed must
    // stay editable — including the very date change that repairs it — and
    // the resulting end date is what gets checked, so reactivating and
    // extending in one request is allowed.
    if (previousStatus !== 'active' && nextStatus === 'active') {
      const nextEndDate = updateData.end_date !== undefined
        ? updateData.end_date
        : campaign.end_date;
      if (nextEndDate && nextEndDate < todayInChurchTz()) {
        return res.status(409).json({
          success: false,
          code: 'CAMPAIGN_WINDOW_PASSED',
          message: `${campaign.name} ended on ${nextEndDate}. Extend its end date before activating it, or create a new campaign so the two drives keep separate totals.`
        });
      }
    }

    await campaign.update(updateData);

    if (req.body.status !== undefined && req.body.status !== previousStatus) {
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'UPDATE',
        entity_type: 'PledgeCampaign',
        entity_id: String(campaign.id),
        details: { from: previousStatus, to: req.body.status },
        ip_address: req.ip
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pledge campaign updated successfully',
      campaign
    });
  } catch (error) {
    console.error('Error updating pledge campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pledge campaign',
      error: error.message
    });
  }
};

module.exports = {
  listActive,
  listAll,
  getTotals,
  create,
  update
};
