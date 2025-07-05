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

// Firebase Auth profile routes (no JWT required)
router.get('/profile/firebase/:uid', memberController.getProfileByFirebaseUid);
router.put('/profile/firebase/:uid', memberController.updateProfileByFirebaseUid);

// Protected routes (require authentication)
router.use(authMiddleware);

// Member profile routes
router.get('/profile', memberController.getProfile);
router.put('/profile', validateProfileUpdate, memberController.updateProfile);

// Admin routes (require admin role)
router.get('/all', 
  roleMiddleware(['accountant', 'auditor', 'clergy']), 
  validateMemberQuery, 
  memberController.getAllMembers
);

router.get('/:id', 
  roleMiddleware(['accountant', 'auditor', 'clergy']), 
  validateMemberId, 
  memberController.getMemberById
);

router.put('/:id', 
  roleMiddleware(['accountant', 'clergy']), 
  validateMemberId, 
  memberController.updateMember
);

router.delete('/:id', 
  roleMiddleware(['accountant']), 
  validateMemberId, 
  memberController.deleteMember
);

// Financial routes (require accountant/auditor role)
router.get('/:id/contributions', 
  roleMiddleware(['accountant', 'auditor']), 
  validateMemberId, 
  memberController.getMemberContributions
);

module.exports = router; 