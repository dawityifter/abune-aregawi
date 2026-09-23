'use strict';

const {
  buildSnapshot, buildMonthlySeries, buildComparison
} = require('../services/pledgeDashboardService');
const { canSeeDonors } = require('../services/pledgeDashboardPrivacy');
const { PledgeCampaign } = require('../models');

const getDashboard = async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.params.id, { canSee: canSeeDonors(req) });
    if (!snapshot) {
      return res.status(404).json({ success: false, message: 'Pledge campaign not found' });
    }
    return res.status(200).json({ success: true, dashboard: snapshot });
  } catch (error) {
    console.error('Error building pledge dashboard:', error);
    return res.status(500).json({
      success: false, message: 'Failed to build the pledge dashboard', error: error.message
    });
  }
};

const getMonthly = async (req, res) => {
  try {
    const campaign = await PledgeCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Pledge campaign not found' });
    }
    const series = await buildMonthlySeries(req.params.id);
    return res.status(200).json({ success: true, series });
  } catch (error) {
    console.error('Error building monthly pledge series:', error);
    return res.status(500).json({
      success: false, message: 'Failed to build the monthly series', error: error.message
    });
  }
};

const getComparison = async (req, res) => {
  try {
    const priorId = req.query.to;
    if (!priorId) {
      return res.status(400).json({
        success: false,
        message: 'A `to` campaign id is required to compare against'
      });
    }
    const comparison = await buildComparison(req.params.id, priorId);
    if (!comparison) {
      return res.status(404).json({ success: false, message: 'Pledge campaign not found' });
    }
    return res.status(200).json({ success: true, comparison });
  } catch (error) {
    console.error('Error building pledge comparison:', error);
    return res.status(500).json({
      success: false, message: 'Failed to build the comparison', error: error.message
    });
  }
};

module.exports = { getDashboard, getMonthly, getComparison };
