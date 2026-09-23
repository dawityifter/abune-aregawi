'use strict';

const {
  PledgeCampaign, CampaignTotal, CampaignStatusTotal
} = require('../models');
const { countActiveHouseholds, todayInChurchTz } = require('./pledgeCampaignService');
const { suppressSmall } = require('./pledgeDashboardPrivacy');

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Math.round(value * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayCount = (fromISO, toISO) =>
  Math.round((Date.parse(toISO) - Date.parse(fromISO)) / DAY_MS) + 1;

/**
 * Day-of-campaign maths in church time. A drive with no end_date has no total
 * and no remaining — an open-ended campaign has no pace to be behind.
 */
const buildTimeline = (campaign, today = todayInChurchTz()) => {
  const start = campaign.start_date;
  const end = campaign.end_date;
  const elapsed = Math.max(1, dayCount(start, today));
  if (!end) {
    return { day: elapsed, total_days: null, days_remaining: null, elapsed_fraction: null };
  }
  const total = dayCount(start, end);
  const day = Math.min(Math.max(elapsed, 1), total);
  return {
    day,
    total_days: total,
    days_remaining: total - day,
    elapsed_fraction: round2(day / total)
  };
};

const buildMoney = (totals, campaign, timeline) => {
  const pledged = num(totals?.total_pledged);
  const collected = num(totals?.total_collected);
  // outstanding_positive, never the netted `outstanding` — that one lets one
  // member's over-payment cancel another member's shortfall.
  const outstandingOwed = num(totals?.outstanding_positive);
  const overpaid = num(totals?.overpaid_amount);
  const goal = campaign.goal_amount == null ? null : num(campaign.goal_amount);

  const gapToGoal = goal == null ? null : round2(Math.max(goal - collected, 0));
  const percentToGoal = goal ? round2((collected / goal) * 100) : null;
  const fulfillmentRate = pledged ? round2((collected / pledged) * 100) : 0;

  const linearPaceTarget = (goal != null && timeline.elapsed_fraction != null)
    ? round2(goal * timeline.elapsed_fraction) : null;
  const requiredRunRate = (gapToGoal != null && timeline.days_remaining > 0)
    ? round2(gapToGoal / timeline.days_remaining) : null;

  return {
    pledged, collected, outstanding_owed: outstandingOwed, overpaid, goal,
    gap_to_goal: gapToGoal, percent_to_goal: percentToGoal,
    fulfillment_rate: fulfillmentRate,
    linear_pace_target: linearPaceTarget, required_run_rate: requiredRunRate
  };
};

const buildParticipation = async (totals) => {
  const { households: active, familyIdPopulated } = await countActiveHouseholds();
  const households = Number(totals?.household_count) || 0;
  return {
    households,
    active_households: active,
    rate: active ? round2((households / active) * 100) : 0,
    anonymous_pledges: Number(totals?.anonymous_pledge_count) || 0,
    anonymous_collected: num(totals?.anonymous_collected),
    family_id_populated: familyIdPopulated
  };
};

const buildBreakdown = (rows, canSee) => rows.map((row) => {
  const size = Number(row.pledge_count) || 0;
  return {
    status: row.status,
    pledge_count: suppressSmall(size, size, canSee),
    household_count: suppressSmall(Number(row.household_count) || 0, size, canSee),
    total_pledged: suppressSmall(num(row.total_pledged), size, canSee),
    total_collected: suppressSmall(num(row.total_collected), size, canSee),
    outstanding_owed: suppressSmall(num(row.outstanding_positive), size, canSee)
  };
});

/** Returns null when the campaign does not exist, so the controller can 404. */
const buildSnapshot = async (campaignId, { canSee }) => {
  const campaign = await PledgeCampaign.findByPk(campaignId);
  if (!campaign) return null;

  const [totals, statusRows] = await Promise.all([
    CampaignTotal.findByPk(campaignId),
    CampaignStatusTotal.findAll({ where: { campaign_id: campaignId }, order: [['status', 'ASC']] })
  ]);

  const timeline = buildTimeline(campaign);

  return {
    campaign: {
      id: String(campaign.id),
      slug: campaign.slug,
      name: campaign.name,
      name_ti: campaign.name_ti,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status,
      goal_amount: campaign.goal_amount == null ? null : num(campaign.goal_amount)
    },
    timeline,
    money: buildMoney(totals, campaign, timeline),
    participation: await buildParticipation(totals),
    breakdown: buildBreakdown(statusRows, canSee),
    as_of: new Date().toISOString()
  };
};

module.exports = { buildSnapshot, buildTimeline, num, round2, dayCount };
