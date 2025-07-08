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
const { authMiddleware, firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Public routes
router.post('/register', validateMemberRegistration, memberController.register);
router.post('/login', validateLogin, memberController.login);

// Firebase Auth profile routes (no JWT required)
router.get('/profile/firebase/:uid', memberController.getProfileByFirebaseUid);
router.put('/profile/firebase/:uid', memberController.updateProfileByFirebaseUid);

// Firebase Auth admin routes (Firebase token verification)
router.get('/all/firebase', firebaseAuthMiddleware, validateMemberQuery, memberController.getAllMembersFirebase);

// Children management routes (no JWT required - using member ID)
router.get('/:memberId/children', memberController.getMemberChildren);
router.post('/:memberId/children', memberController.addChild);
router.put('/children/:childId', memberController.updateChild);
router.delete('/children/:childId', memberController.deleteChild);

// Protected routes (require authentication)
router.use(authMiddleware);

// Member profile routes
router.get('/profile', memberController.getProfile);
router.put('/profile', validateProfileUpdate, memberController.updateProfile);

// Admin routes (require admin role)
router.get('/all', 
  roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary']), 
  validateMemberQuery, 
  memberController.getAllMembers
);

router.get('/:id', 
  roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary']), 
  validateMemberId, 
  memberController.getMemberById
);

router.put('/:id', 
  roleMiddleware(['admin', 'church_leadership', 'secretary']), 
  validateMemberId, 
  memberController.updateMember
);

router.delete('/:id', 
  roleMiddleware(['admin']), 
  validateMemberId, 
  memberController.deleteMember
);

// Financial routes (require treasurer/admin role)
router.get('/:id/contributions', 
  roleMiddleware(['admin', 'treasurer']), 
  validateMemberId, 
  memberController.getMemberContributions
);

module.exports = router; 