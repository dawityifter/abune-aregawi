const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const memberPaymentController = require('../controllers/memberPaymentController');
const {
  validateMemberRegistration,
  validateLogin,
  validateProfileUpdate,
  validateMemberId,
  validateMemberQuery,
  validateDependentId,
  validateDependentData,
  validateDependentUpdate,
  validateSelfClaimStart,
  validateSelfClaimVerify,
  validateSelfClaimLink,
  validateOutreachCreate
} = require('../middleware/validation');
const { authMiddleware, firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const activityLoggerMiddleware = require('../middleware/activityLog');
const admin = require('firebase-admin');
const outreachController = require('../controllers/outreachController');

// Only verifies Firebase ID token, does not check DB
const verifyFirebaseTokenOnly = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No Firebase token provided.' });
    }
    const firebaseToken = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    req.firebaseUid = decodedToken.uid;
    // Attach phone number from token when present to help authorize dependents
    if (decodedToken.phone_number) {
      req.firebasePhone = decodedToken.phone_number;
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
  }
};

// Public routes
router.post('/register', activityLoggerMiddleware('Member'), validateMemberRegistration, memberController.register);

// Validate head of household phone number
router.get('/validate-head-of-household/:phoneNumber', memberController.validateHeadOfHouseholdPhone);

// Public: check if a phone number already exists (for admin add-member validation)
router.get('/check-phone/:phoneNumber', memberController.checkPhoneExists);

// Complete registration after Firebase Auth (prevents partial saves)
router.post('/complete-registration/:firebaseUid', memberController.completeRegistration);

// Check registration status
router.get('/registration-status', memberController.checkRegistrationStatus);

// Cleanup orphaned users (admin only)
router.get('/titles', memberController.getTitles);

router.get('/cleanup-orphaned',
  roleMiddleware(['admin']),
  memberController.cleanupOrphanedUsers
);
router.post('/login', validateLogin, memberController.login);

// Firebase Auth profile routes (no JWT required)
router.get('/profile/firebase/:uid', memberController.getProfileByFirebaseUid);
router.put('/profile/firebase/:uid', validateProfileUpdate, memberController.updateProfileByFirebaseUid);

// Member dues (current user's own dues) using Firebase token only
router.get('/dues/my', verifyFirebaseTokenOnly, memberPaymentController.getMyDues);

// Member dues for a specific member (for dependents viewing head-of-household dues)
// Authorization: caller must be the same member OR a dependent linked to that member
router.get('/dues/by-member/:memberId', verifyFirebaseTokenOnly, memberPaymentController.getDuesByMemberIdWithAuth);

// Test endpoint to debug authentication
router.get('/test-auth', firebaseAuthMiddleware, (req, res) => {
  console.log('🔍 Test auth endpoint hit');
  console.log('🔍 req.user:', req.user);
  console.log('🔍 req.firebaseUid:', req.firebaseUid);
  res.json({
    success: true,
    message: 'Authentication working',
    user: req.user,
    firebaseUid: req.firebaseUid
  });
});

// Firebase Auth admin routes (Firebase token verification)
router.get('/all/firebase', firebaseAuthMiddleware, roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary']), validateMemberQuery, memberController.getAllMembersFirebase);

// Dependents management routes (no JWT required - using member ID)
router.get('/dependents/count', firebaseAuthMiddleware, roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary']), memberController.getTotalDependentsCount);
router.get('/:memberId/dependents', validateMemberId, memberController.getMemberDependents);
router.post('/:memberId/dependents', validateMemberId, validateDependentData, activityLoggerMiddleware('Dependent'), memberController.addDependent);
router.put('/dependents/:dependentId', validateDependentId, validateDependentData, activityLoggerMiddleware('Dependent'), memberController.updateDependent);
router.patch('/dependents/:dependentId', validateDependentId, validateDependentUpdate, activityLoggerMiddleware('Dependent'), memberController.updateDependent);
router.delete('/dependents/:dependentId', validateDependentId, activityLoggerMiddleware('Dependent'), memberController.deleteDependent);

// JWT-protected profile routes (for testing and JWT-based auth)
router.get('/profile/jwt', authMiddleware, memberController.getProfile);
router.put('/profile/jwt', authMiddleware, validateProfileUpdate, memberController.updateProfile);

// Protected routes (require Firebase authentication)
router.use(firebaseAuthMiddleware);

// Member profile routes
router.get('/profile', memberController.getProfile);
router.put('/profile', validateProfileUpdate, memberController.updateProfile);

// Member search (treasurer/admin)
router.get('/search',
  roleMiddleware(['admin', 'treasurer']),
  memberController.searchMembers
);

// Dependent self-claim routes
router.post('/dependents/self-claim/start', validateSelfClaimStart, memberController.selfClaimStart);
router.post('/dependents/self-claim/verify', validateSelfClaimVerify, memberController.selfClaimVerify);
router.post('/dependents/self-claim/link', validateSelfClaimLink, memberController.selfClaimLink);

// Onboarding / Outreach routes
router.get('/onboarding/pending',
  roleMiddleware(['admin', 'relationship']),
  memberController.getPendingWelcomes
);

// Outreach note routes
router.post('/:id/outreach',
  roleMiddleware(['admin', 'relationship']),
  validateOutreachCreate,
  activityLoggerMiddleware('Outreach'),
  outreachController.createOutreach
);

router.get('/:id/outreach',
  roleMiddleware(['admin', 'relationship']),
  validateMemberId,
  outreachController.listOutreach
);

router.post('/:id/mark-welcomed',
  roleMiddleware(['admin', 'relationship']),
  validateMemberId,
  activityLoggerMiddleware('Member'),
  memberController.markWelcomed
);

// Admin routes (require admin role)
router.get('/all',
  roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary']),
  validateMemberQuery,
  memberController.getAllMembers
);

router.get('/:id',
  roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary', 'relationship']),
  validateMemberId,
  memberController.getMemberById
);

// Public routes (or authenticated, depending on preference. Making authenticated for safety)



router.put('/:id',
  roleMiddleware(['admin', 'secretary']),
  activityLoggerMiddleware('Member'),
  validateMemberId,
  memberController.updateMember
);

// Update member role (admin only)
router.patch('/:id/role',
  roleMiddleware(['admin']),
  validateMemberId,
  activityLoggerMiddleware('Member'),
  memberController.updateMemberRole
);

router.delete('/:id',
  roleMiddleware(['admin']),
  validateMemberId,
  activityLoggerMiddleware('Member'),
  memberController.deleteMember
);

// Promote dependent to member (admin only)
router.post('/dependents/:dependentId/promote',
  roleMiddleware(['admin', 'church_leadership']),
  activityLoggerMiddleware('Member'),
  memberController.promoteDependent
);


// Financial routes (require treasurer/admin role)
router.get('/:id/contributions',
  roleMiddleware(['admin', 'treasurer']),
  validateMemberId,
  memberController.getMemberContributions
);

router.post('/firebase/delete-user', verifyFirebaseTokenOnly, async (req, res) => {
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