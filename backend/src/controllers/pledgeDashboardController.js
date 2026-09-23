'use strict';

const { buildSnapshot, buildMonthlySeries } = require('../services/pledgeDashboardService');
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

module.exports = { getDashboard, getMonthly };
