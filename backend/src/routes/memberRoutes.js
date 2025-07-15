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
const admin = require('firebase-admin');

// Public routes
router.post('/register', validateMemberRegistration, memberController.register);

// Complete registration after Firebase Auth (prevents partial saves)
router.post('/complete-registration/:firebaseUid', memberController.completeRegistration);

// Check registration status
router.get('/registration-status', memberController.checkRegistrationStatus);

// Cleanup orphaned users (admin only)
router.get('/cleanup-orphaned', 
  roleMiddleware(['admin']), 
  memberController.cleanupOrphanedUsers
);
router.post('/login', validateLogin, memberController.login);

// Firebase Auth profile routes (no JWT required)
router.get('/profile/firebase/:uid', memberController.getProfileByFirebaseUid);
router.put('/profile/firebase/:uid', memberController.updateProfileByFirebaseUid);

// Firebase Auth admin routes (Firebase token verification)
router.get('/all/firebase', firebaseAuthMiddleware, validateMemberQuery, memberController.getAllMembersFirebase);

// Dependants management routes (no JWT required - using member ID)
router.get('/:memberId/dependants', memberController.getMemberDependants);
router.post('/:memberId/dependants', memberController.addDependant);
router.put('/dependants/:dependantId', memberController.updateDependant);
router.delete('/dependants/:dependantId', memberController.deleteDependant);

// Protected routes (require Firebase authentication)
router.use(firebaseAuthMiddleware);

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

// Update member role (admin only)
router.patch('/:id/role', 
  roleMiddleware(['admin']), 
  validateMemberId, 
  memberController.updateMemberRole
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

router.post('/firebase/delete-user', async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ message: 'UID is required.' });
  }
  try {
    await admin.auth().deleteUser(uid);
    res.status(200).json({ message: 'User deleted from Firebase.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user from Firebase.', error: err.message });
  }
});

module.exports = router; 