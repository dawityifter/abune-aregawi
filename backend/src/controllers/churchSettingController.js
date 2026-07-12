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

// Reconciliation threshold (dollars): the max ledger-vs-bank gap before the
// Payment Overview flags "reconciliation required". Shared by receipts/expenses.
const RECONCILE_THRESHOLD_KEY = 'reconcile_threshold_dollars';
const RECONCILE_THRESHOLD_DEFAULT = 50;

// Read the current threshold as a number, falling back to the default when the
// setting is missing or invalid. Reusable from getPaymentStats.
const getReconcileThresholdValue = async () => {
  try {
    const setting = await ChurchSetting.findByPk(RECONCILE_THRESHOLD_KEY);
    const parsed = setting ? parseFloat(setting.value) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : RECONCILE_THRESHOLD_DEFAULT;
  } catch (err) {
    console.error('getReconcileThresholdValue error:', err);
    return RECONCILE_THRESHOLD_DEFAULT;
  }
};

// GET /api/settings/reconcile-threshold
const getReconcileThreshold = async (req, res) => {
  try {
    const dollars = await getReconcileThresholdValue();
    return res.json({ success: true, data: { dollars } });
  } catch (err) {
    console.error('getReconcileThreshold error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get reconciliation threshold' });
  }
};

// PUT /api/settings/reconcile-threshold  body: { dollars }
const setReconcileThreshold = async (req, res) => {
  try {
    const dollars = parseFloat(req.body?.dollars);
    if (!Number.isFinite(dollars) || dollars < 0 || dollars > 100000) {
      return res.status(400).json({ success: false, message: 'dollars must be a number between 0 and 100000' });
    }
    await ChurchSetting.upsert({ key: RECONCILE_THRESHOLD_KEY, value: String(dollars) });
    return res.json({ success: true, data: { dollars } });
  } catch (err) {
    console.error('setReconcileThreshold error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update reconciliation threshold' });
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
  getReconcileThreshold,
  setReconcileThreshold,
  getReconcileThresholdValue,
  getLedgerSheetsSettings,
  updateLedgerSheetsSettings,
  runLedgerSheetsFullExport,
  runLedgerSheetsSyncNow
};
