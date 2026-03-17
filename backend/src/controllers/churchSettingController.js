'use strict';
const { ChurchSetting } = require('../models');

// GET /api/settings/tv-rotation-interval
const getTvRotationInterval = async (req, res) => {
  try {
    const setting = await ChurchSetting.findByPk('tv_rotation_interval_seconds');
    const seconds = setting ? parseInt(setting.value, 10) : 30;
    return res.json({ success: true, data: { seconds } });
  } catch (err) {
    console.error('getTvRotationInterval error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get TV rotation interval' });
  }
};

// PUT /api/settings/tv-rotation-interval
const setTvRotationInterval = async (req, res) => {
  try {
    const { seconds } = req.body;
    const value = parseInt(seconds, 10);
    if (!value || value < 5 || value > 300) {
      return res.status(400).json({ success: false, message: 'seconds must be between 5 and 300' });
    }
    await ChurchSetting.upsert({ key: 'tv_rotation_interval_seconds', value: String(value) });
    return res.json({ success: true, data: { seconds: value } });
  } catch (err) {
    console.error('setTvRotationInterval error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update TV rotation interval' });
  }
};

module.exports = { getTvRotationInterval, setTvRotationInterval };
