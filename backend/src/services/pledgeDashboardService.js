'use strict';

const {
  PledgeCampaign, CampaignTotal, CampaignStatusTotal, PledgeBalance, Pledge,
  PledgeAllocation, Transaction
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

const STALLED_AFTER_DAYS = 60;
const ENDING_SOON_DAYS = 30;

/**
 * Five operational counts, derived from pledge_balances. Counts only — the
 * names behind them stay on the tier-3 detail route, so this payload is safe
 * for every view role (small buckets are still blanked for tier 2).
 *
 * Cancelled pledges are excluded from all of them: a retired pledge owes
 * nothing and needs no chasing.
 */
const buildAttention = async (campaignId, timeline, canSee) => {
  const balances = await PledgeBalance.findAll({ where: { campaign_id: campaignId } });

  const live = balances.filter((b) => b.derived_status !== 'cancelled');
  const cutoff = Date.now() - STALLED_AFTER_DAYS * DAY_MS;

  const stalled = live.filter((b) =>
    b.derived_status === 'partially_fulfilled'
    && b.last_payment_at
    && Date.parse(b.last_payment_at) < cutoff).length;

  const neverStarted = live.filter((b) => b.derived_status === 'not_started').length;
  const overpaid = live.filter((b) => num(b.remaining_amount) < 0).length;
  const unlinked = live.filter((b) => b.member_id == null).length;

  return {
    stalled: suppressSmall(stalled, stalled, canSee),
    never_started: suppressSmall(neverStarted, neverStarted, canSee),
    overpaid: suppressSmall(overpaid, overpaid, canSee),
    unlinked: suppressSmall(unlinked, unlinked, canSee),
    ending_soon: timeline.days_remaining != null
      && timeline.days_remaining <= ENDING_SOON_DAYS
  };
};

/**
 * Money received per calendar month for one drive.
 *
 * Grouped in JavaScript rather than SQL on purpose: month extraction is
 * `to_char` on Postgres and `strftime` on SQLite, and this file has to run on
 * both. The row count is one per allocation for a single campaign — a few
 * hundred at parish scale — so the cost is irrelevant.
 *
 * Pre-allocation drives return available:false rather than an empty chart:
 * their fulfilment was a flag on the pledge with no payment date anywhere, so
 * an empty series would read as "nothing was collected" when in fact tens of
 * thousands were.
 *
 * A campaign can also mix historical and modern pledges (e.g. a handful of
 * legacy pledges carried into an otherwise-current drive). Those historical
 * pledges have no allocations, so the months below are real but do not add up
 * to the campaign's full collections — flipping `available` to false would
 * hide an otherwise useful chart over a minority of pledges, so instead we
 * surface `partial_historical: true` and let the consumer caption the chart
 * rather than presenting its total as complete.
 */
const buildMonthlySeries = async (campaignId) => {
  const pledges = await Pledge.findAll({
    where: { campaign_id: campaignId },
    attributes: ['id', 'is_historical']
  });

  if (pledges.length && pledges.every((p) => p.is_historical)) {
    return {
      available: false, reason: 'historical_campaign', partial_historical: false, months: []
    };
  }
  // Reaching here already means not every pledge is historical (the all-historical
  // case returned above), so the only thing left to check is whether any are.
  const partialHistorical = pledges.some((p) => p.is_historical);

  const allocations = await PledgeAllocation.findAll({
    where: { pledge_id: pledges.map((p) => p.id) },
    include: [{
      model: Transaction, as: 'transaction',
      attributes: ['payment_date', 'status'], required: true
    }]
  });

  const byMonth = new Map();
  allocations.forEach((a) => {
    if (a.transaction.status !== 'succeeded') return;
    const month = String(a.transaction.payment_date).slice(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) || 0) + num(a.amount));
  });

  let running = 0;
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, collected]) => {
      running = round2(running + collected);
      return { month, collected: round2(collected), cumulative: running };
    });

  return { available: true, reason: null, partial_historical: partialHistorical, months };
};

/**
 * Cumulative pledged dollars by day-of-campaign, from pledges.created_at.
 *
 * This is PLEDGING, not collections. The 2025 drive has no payment dates at
 * all, so a collections curve cannot be built for it and must never be faked;
 * created_at is a real pledge date on both drives, which makes this the one
 * curve that compares honestly. Cancelled pledges are excluded.
 *
 * A pledge dated before `startDate` is clamped to day 1, deliberately: a
 * cumulative series at day N means "everything pledged on or before day N",
 * and day 1 is the earliest day the series has. Filtering such pledges out
 * instead would desync the curve's final value from `figures.total_pledged`,
 * which counts every non-cancelled pledge regardless of date.
 */
const buildPledgingCurve = (pledges, startDate) => {
  const points = pledges
    .filter((p) => p.lifecycle !== 'cancelled')
    .map((p) => ({
      day: Math.max(1, dayCount(startDate, new Date(p.created_at).toISOString().slice(0, 10))),
      amount: num(p.amount)
    }))
    .sort((a, b) => a.day - b.day);

  const byDay = new Map();
  points.forEach(({ day, amount }) => byDay.set(day, (byDay.get(day) || 0) + amount));

  let running = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, amount]) => {
      running = round2(running + amount);
      return { day, cumulative_pledged: running };
    });
};

const summarise = async (campaign) => {
  const totals = await CampaignTotal.findByPk(campaign.id);
  const statusRows = await CampaignStatusTotal.findAll({
    where: { campaign_id: campaign.id }
  });
  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r]));
  const pledged = num(totals?.total_pledged);
  const collected = num(totals?.total_collected);

  return {
    total_pledged: pledged,
    total_collected: collected,
    outstanding_owed: num(totals?.outstanding_positive),
    pledge_count: Number(totals?.pledge_count) || 0,
    household_count: Number(totals?.household_count) || 0,
    fulfillment_rate: pledged ? round2((collected / pledged) * 100) : 0,
    fully_paid: Number(byStatus.fulfilled?.pledge_count) || 0,
    never_paid: Number(byStatus.not_started?.pledge_count) || 0
  };
};

const describeWindow = (campaign, today = todayInChurchTz()) => {
  const timeline = buildTimeline(campaign, today);
  const ended = campaign.end_date ? Date.parse(campaign.end_date) < Date.parse(today) : false;
  return {
    id: String(campaign.id),
    slug: campaign.slug,
    name: campaign.name,
    start_date: campaign.start_date,
    end_date: campaign.end_date,
    total_days: timeline.total_days,
    in_progress: !ended,
    day: timeline.day
  };
};

/**
 * Returns null when either campaign is missing, so the controller can 404.
 *
 * `comparable` is the contract that keeps this honest. Plan 3 reads it to
 * decide which rows to render at all — a comparison it cannot compute must be
 * OMITTED, never drawn as a zero, because a zero bar reads as "we did badly"
 * rather than "we do not know" (spec section 6, rule 3).
 */
const buildComparison = async (currentId, priorId) => {
  const [currentCampaign, priorCampaign] = await Promise.all([
    PledgeCampaign.findByPk(currentId),
    PledgeCampaign.findByPk(priorId)
  ]);
  if (!currentCampaign || !priorCampaign) return null;

  const [currentPledges, priorPledges] = await Promise.all([
    Pledge.findAll({
      where: { campaign_id: currentId },
      attributes: ['amount', 'created_at', 'lifecycle', 'is_historical']
    }),
    Pledge.findAll({
      where: { campaign_id: priorId },
      attributes: ['amount', 'created_at', 'lifecycle', 'is_historical']
    })
  ]);

  const anyHistorical = (rows) => rows.some((p) => p.is_historical);
  const allocationBacked = !anyHistorical(currentPledges) && !anyHistorical(priorPledges);

  return {
    comparable: {
      goal: currentCampaign.goal_amount != null && priorCampaign.goal_amount != null,
      collections: allocationBacked,
      partial: allocationBacked,
      // Structurally guaranteed, unlike its siblings: created_at is a
      // non-nullable timestamp on every pledge, so this curve can always be built.
      pledging_curve: true
    },
    campaigns: {
      current: describeWindow(currentCampaign),
      prior: describeWindow(priorCampaign)
    },
    figures: await (async () => {
      const [cur, pri] = await Promise.all([
        summarise(currentCampaign), summarise(priorCampaign)
      ]);
      // Keyed off `cur` only — safe because summarise() always returns the
      // same unconditional 8-key literal. If any key there ever becomes
      // conditional, a prior-only key could be silently dropped here.
      return Object.fromEntries(
        Object.keys(cur).map((key) => [key, { current: cur[key], prior: pri[key] }])
      );
    })(),
    pledging_curve: {
      current: buildPledgingCurve(currentPledges, currentCampaign.start_date),
      prior: buildPledgingCurve(priorPledges, priorCampaign.start_date)
    }
  };
};

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
    attention: await buildAttention(campaignId, timeline, canSee),
    as_of: new Date().toISOString()
  };
};

module.exports = {
  buildSnapshot, buildTimeline, buildAttention, buildMonthlySeries,
  buildComparison, buildPledgingCurve, num, round2, dayCount
};
