const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const c = require('../controllers/pledgeCampaignController');
const dashboard = require('../controllers/pledgeDashboardController');

// Same vocabulary as pledgeRoutes.js / transactionRoutes.js — do not invent new role names.
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];
const adminRoles = ['admin'];

// PUBLIC — powers the visitor pledge form. Registered BEFORE the auth
// middleware below so it can never accidentally require a token. Aggregates
// and donor data are excluded at the controller layer (explicit attribute
// list, no campaign_totals join) — see pledgeCampaignController.listActive.
router.get('/active', c.listActive);

router.use(firebaseAuthMiddleware);
router.get('/', roleMiddleware(viewRoles), c.listAll);
router.get('/:id/totals', roleMiddleware(viewRoles), c.getTotals);
// Aggregates only — donor names never appear in this payload. Tier 2 callers
// additionally get small buckets blanked; see pledgeDashboardPrivacy.
router.get('/:id/dashboard', roleMiddleware(viewRoles), dashboard.getDashboard);
router.get('/:id/monthly', roleMiddleware(viewRoles), dashboard.getMonthly);
router.get('/:id/compare', roleMiddleware(viewRoles), dashboard.getComparison);
router.post('/', roleMiddleware(adminRoles), c.create);
router.patch('/:id', roleMiddleware(adminRoles), c.update);

module.exports = router;
