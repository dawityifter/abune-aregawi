'use strict';

const { Op } = require('sequelize');
const { PledgeCampaign } = require('../models');
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

module.exports = { todayInChurchTz, isLive, findLiveCampaign, findOverlappingActive };
