const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const requireOpenCampaign = require('../middleware/requireOpenCampaign');
const allocationController = require('../controllers/pledgeAllocationController');

const editRoles = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];

router.use(firebaseAuthMiddleware);

// Declared BEFORE the /:id/reverse route below: Express matches routes in
// declaration order, and /:id would otherwise capture the literal string
// "unallocated" as an allocation id.
router.get('/unallocated', roleMiddleware(viewRoles), allocationController.listUnallocatedPayments);

// This router is mounted at /api/pledge-allocations, so :id here is an
// ALLOCATION id (not a pledge id) — fromAllocationParam resolves it by
// looking up the allocation, then its pledge, then that pledge's campaign.
router.post('/:id/reverse', roleMiddleware(editRoles),
  requireOpenCampaign(requireOpenCampaign.fromAllocationParam),
  allocationController.reverseAllocation);

module.exports = router;
