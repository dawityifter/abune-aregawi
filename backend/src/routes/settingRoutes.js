'use strict';
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const {
  getTvRotationInterval,
  setTvRotationInterval,
  getLedgerSheetsSettings,
  updateLedgerSheetsSettings,
  runLedgerSheetsFullExport,
  runLedgerSheetsSyncNow
} = require('../controllers/churchSettingController');

const ALLOWED_ROLES = ['admin', 'relationship'];
const LEDGER_ALLOWED_ROLES = ['admin', 'treasurer'];

router.get('/tv-rotation-interval', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), getTvRotationInterval);
router.put('/tv-rotation-interval', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), setTvRotationInterval);
router.get('/ledger-sheets', firebaseAuthMiddleware, roleMiddleware(LEDGER_ALLOWED_ROLES), getLedgerSheetsSettings);
router.put('/ledger-sheets', firebaseAuthMiddleware, roleMiddleware(LEDGER_ALLOWED_ROLES), updateLedgerSheetsSettings);
router.post('/ledger-sheets/export', firebaseAuthMiddleware, roleMiddleware(LEDGER_ALLOWED_ROLES), runLedgerSheetsFullExport);
router.post('/ledger-sheets/sync', firebaseAuthMiddleware, roleMiddleware(LEDGER_ALLOWED_ROLES), runLedgerSheetsSyncNow);

module.exports = router;
