const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { 
  validateMemberRegistration, 
  validateLogin, 
  validateProfileUpdate,
  validateMemberId,
  validateMemberQuery
} = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Public routes
router.post('/register', validateMemberRegistration, memberController.register);
router.post('/login', validateLogin, memberController.login);

// Firebase Auth profile route (no JWT required)
router.get('/profile/firebase/:uid', memberController.getProfileByFirebaseUid);

// Protected routes (require authentication)
router.use(authMiddleware);

// Member profile routes
router.get('/profile', memberController.getProfile);
router.put('/profile', validateProfileUpdate, memberController.updateProfile);

// Admin routes (require admin role)
router.get('/all', 
  roleMiddleware(['Administrator', 'Church Secretary', 'Priest']), 
  validateMemberQuery, 
  memberController.getAllMembers
);

router.get('/:id', 
  roleMiddleware(['Administrator', 'Church Secretary', 'Priest']), 
  validateMemberId, 
  memberController.getMemberById
);

router.put('/:id', 
  roleMiddleware(['Administrator', 'Church Secretary']), 
  validateMemberId, 
  memberController.updateMember
);

router.delete('/:id', 
  roleMiddleware(['Administrator']), 
  validateMemberId, 
  memberController.deleteMember
);

// Treasurer routes (require treasurer role)
router.get('/:id/contributions', 
  roleMiddleware(['Treasurer', 'Administrator']), 
  validateMemberId, 
  memberController.getMemberContributions
);

module.exports = router; 