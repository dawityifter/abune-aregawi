const { PledgeCampaign, CampaignTotal, ActivityLog } = require('../models');
const { Op } = require('sequelize');

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
    const campaigns = await PledgeCampaign.findAll({
      where: { status: 'active' },
      attributes: PUBLIC_ATTRIBUTES,
      order: [['start_date', 'DESC']]
    });

    res.status(200).json({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('Error listing active pledge campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list active pledge campaigns',
      error: error.message
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
