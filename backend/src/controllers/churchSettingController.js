'use strict';
const { ChurchSetting } = require('../models');
const {
  getLedgerSheetsStatus,
  normalizeSchedule,
  runLedgerSheetsExport,
  saveScheduleSettings
} = require('../jobs/ledgerSheets/settingsService');

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

const getLedgerSheetsSettings = async (req, res) => {
  try {
    const data = await getLedgerSheetsStatus();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('getLedgerSheetsSettings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load ledger Sheets settings' });
  }
};

const updateLedgerSheetsSettings = async (req, res) => {
  try {
    const schedule = normalizeSchedule(req.body || {});
    const saved = await saveScheduleSettings(schedule);
    const data = await getLedgerSheetsStatus();
    return res.json({ success: true, data: { ...data, schedule: { ...saved, nextRunAt: data.schedule?.nextRunAt || null } } });
  } catch (err) {
    console.error('updateLedgerSheetsSettings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update ledger Sheets schedule' });
  }
};

const runLedgerSheetsFullExport = async (req, res) => {
  try {
    const requestedBy = req.user?.email || req.user?.uid || req.user?.id || req.user?.member_id || 'manual';
    const data = await runLedgerSheetsExport({
      mode: 'full',
      requestedBy,
      logger: console
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('runLedgerSheetsFullExport error:', err);
    const status = /already running/i.test(err.message) ? 409 : 500;
    return res.status(status).json({ success: false, message: err.message || 'Failed to run full ledger export' });
  }
};

const runLedgerSheetsSyncNow = async (req, res) => {
  try {
    const requestedBy = req.user?.email || req.user?.uid || req.user?.id || req.user?.member_id || 'manual';
    const data = await runLedgerSheetsExport({
      mode: 'sync',
      requestedBy,
      logger: console
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('runLedgerSheetsSyncNow error:', err);
    const status = /already running/i.test(err.message) ? 409 : 500;
    return res.status(status).json({ success: false, message: err.message || 'Failed to run ledger sync' });
  }
};

module.exports = {
  getTvRotationInterval,
  setTvRotationInterval,
  getLedgerSheetsSettings,
  updateLedgerSheetsSettings,
  runLedgerSheetsFullExport,
  runLedgerSheetsSyncNow
};
