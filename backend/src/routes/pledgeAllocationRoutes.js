const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const requireOpenCampaign = require('../middleware/requireOpenCampaign');
const allocationController = require('../controllers/pledgeAllocationController');

const editRoles = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];

router.use(firebaseAuthMiddleware);

// This router is mounted at /api/pledge-allocations, so :id here is an
// ALLOCATION id (not a pledge id) — fromAllocationParam resolves it by
// looking up the allocation, then its pledge, then that pledge's campaign.
router.post('/:id/reverse', roleMiddleware(editRoles),
  requireOpenCampaign(requireOpenCampaign.fromAllocationParam),
  allocationController.reverseAllocation);

module.exports = router;
