'use strict';

const { Pledge, PledgeCampaign, PledgeAllocation } = require('../models');

// The 2025 drive is preserved read-only. Every pledge/allocation write route
// passes through here. The append-only trigger on pledge_allocations is the
// second layer — this one produces the friendly error.
const requireOpenCampaign = (resolveCampaignId) => async (req, res, next) => {
  try {
    const campaignId = await resolveCampaignId(req);
    if (campaignId == null) return next();

    const campaign = await PledgeCampaign.findByPk(campaignId);
    if (!campaign) return next();

    if (campaign.status === 'closed') {
      return res.status(409).json({
        success: false,
        code: 'CAMPAIGN_CLOSED',
        message: `${campaign.name} is closed and preserved as read-only history.`
      });
    }

    req.campaign = campaign;
    return next();
  } catch (err) {
    return next(err);
  }
};

requireOpenCampaign.fromBody = (req) => req.body?.campaign_id ?? null;

requireOpenCampaign.fromPledgeParam = async (req) => {
  const id = req.params.id ?? req.params.pledgeId;
  if (!id) return null;
  const pledge = await Pledge.findByPk(id, { attributes: ['id', 'campaign_id'] });
  return pledge ? pledge.campaign_id : null;
};

requireOpenCampaign.fromAllocationParam = async (req) => {
  const id = req.params.id ?? req.params.allocationId;
  if (!id) return null;
  const allocation = await PledgeAllocation.findByPk(id, { attributes: ['id', 'pledge_id'] });
  if (!allocation) return null;
  const pledge = await Pledge.findByPk(allocation.pledge_id, { attributes: ['id', 'campaign_id'] });
  return pledge ? pledge.campaign_id : null;
};

module.exports = requireOpenCampaign;
