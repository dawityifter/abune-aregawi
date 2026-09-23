const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const c = require('../controllers/pledgeCampaignController');
const dashboard = require('../controllers/pledgeDashboardController');
const { TIER3_ROLES } = require('../services/pledgeDashboardPrivacy');

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
// Tier 3 only, for now — NOT viewRoles like the routes above. Both series carry
// a running cumulative (month-over-month collections; day-over-day cumulative
// pledged), so suppressing an individual point does not protect it: the value
// is recoverable from the delta between its unsuppressed neighbours. Safely
// exposing either series to tier 2 needs coarsening (weekly buckets, or a
// campaign-wide minimum bucket size) — a design question for the dashboard UI
// plan, not a privacy patch here. Restricting now is the conservative
// direction; widening later, once a coarsening design exists, is easy.
router.get('/:id/monthly', roleMiddleware(TIER3_ROLES), dashboard.getMonthly);
router.get('/:id/compare', roleMiddleware(TIER3_ROLES), dashboard.getComparison);
router.post('/', roleMiddleware(adminRoles), c.create);
router.patch('/:id', roleMiddleware(adminRoles), c.update);

module.exports = router;
