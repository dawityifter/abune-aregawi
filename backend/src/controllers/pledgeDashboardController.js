'use strict';

const { buildSnapshot } = require('../services/pledgeDashboardService');
const { canSeeDonors } = require('../services/pledgeDashboardPrivacy');

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

module.exports = { getDashboard };
