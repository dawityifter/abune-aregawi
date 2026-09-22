'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { PledgeCampaign, Member } = require('../models');
const { now, formatForDB } = require('../config/timezone');

/**
 * "Today" for every campaign date comparison, as YYYY-MM-DD in the church's
 * timezone (America/Chicago). Deliberately not UTC: a drive ending today must
 * stay live through its final Dallas evening, and UTC would end it early.
 */
const todayInChurchTz = () => formatForDB(now());

/**
 * A campaign is live when an admin has activated it AND today falls inside its
 * window. start_date/end_date are DATEONLY, so they arrive as 'YYYY-MM-DD'
 * strings and compare correctly as strings. A null end_date means open-ended.
 */
const isLive = (campaign, today = todayInChurchTz()) => {
  if (!campaign || campaign.status !== 'active') return false;
  if (campaign.start_date > today) return false;
  if (campaign.end_date && campaign.end_date < today) return false;
  return true;
};

const findLiveCampaign = async () => {
  const today = todayInChurchTz();
  return PledgeCampaign.findOne({
    where: {
      status: 'active',
      start_date: { [Op.lte]: today },
      [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: today } }]
    },
    // Enforcement of "one live campaign" is newer than the data, so it cannot
    // fix rows activated before it existed. If two somehow match, return the
    // most recent rather than erroring — the public home page must not break
    // because of a data state an admin created.
    order: [['start_date', 'DESC']]
  });
};

/**
 * The active campaign whose window intersects the candidate's, or null.
 * Two windows overlap when each starts on or before the other ends, with a
 * null end date treated as no upper bound.
 */
const findOverlappingActive = async ({ id, start_date, end_date }) => {
  const conditions = [
    { [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: start_date } }] }
  ];
  if (end_date) conditions.push({ start_date: { [Op.lte]: end_date } });

  const where = { status: 'active', [Op.and]: conditions };
  if (id) where.id = { [Op.ne]: id };

  return PledgeCampaign.findOne({ where });
};

/**
 * The participation denominator for the pledge dashboard.
 *
 * The household key is COALESCE(family_id, id) — the SAME key campaign_totals
 * uses for the numerator. It has to be: a head of household is either
 * family_id IS NULL or family_id = own id (both forms exist; see
 * memberReportController's `isHead`), so counting only the NULL form would drop
 * every self-pointing head from the denominator while the numerator still
 * counts it, and push participation above 100%.
 *
 * familyIdPopulated is the honesty check. It requires family_id to be non-null
 * AND to point at someone else, because a self-pointing head links nobody. When
 * it is false, every member reads as their own household and this figure is a
 * member count wearing a household label — callers must relabel the metric
 * rather than publish a precise-looking number that is not what it says.
 *
 * One aggregate query, no GROUP BY, so it returns exactly one row even against
 * an empty members table (COUNT 0, SUM NULL).
 */
const countActiveHouseholds = async () => {
  const row = await Member.findOne({
    attributes: [
      [fn('COUNT', fn('DISTINCT', fn('COALESCE', col('family_id'), col('id')))), 'households'],
      [fn('COUNT', col('id')), 'active_members'],
      [fn('SUM', literal(
        'CASE WHEN family_id IS NOT NULL AND family_id <> id THEN 1 ELSE 0 END'
      )), 'linked']
    ],
    where: { is_active: true },
    raw: true
  });

  return {
    households: Number(row?.households) || 0,
    activeMembers: Number(row?.active_members) || 0,
    familyIdPopulated: (Number(row?.linked) || 0) > 0
  };
};

module.exports = { todayInChurchTz, isLive, findLiveCampaign, findOverlappingActive, countActiveHouseholds };
