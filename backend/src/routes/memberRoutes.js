const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const memberPaymentController = require('../controllers/memberPaymentController');
const memberReportController = require('../controllers/memberReportController');
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
const { Member, Dependent } = require('../models');

// Only verifies Firebase ID token, does not check DB
const verifyFirebaseTokenOnly = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No Firebase token provided.' });
    }
    const firebaseToken = authHeader.substring(7);

    // Demo bypass — only honored when demo mode is explicitly enabled
    if (process.env.ENABLE_DEMO_MODE === 'true' && firebaseToken === 'MAGIC_DEMO_TOKEN') {
      req.firebaseUid = 'magic-demo-uid';
      req.firebaseEmail = 'demo@admin.com';
      req.firebasePhone = '+14699078229';
      return next();
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    req.firebaseUid = decodedToken.uid;
    // Attach email/phone from token when present so controllers can bind the
    // request to the caller's own identity (never trust client-supplied ids).
    if (decodedToken.email) {
      req.firebaseEmail = decodedToken.email;
    }
    if (decodedToken.phone_number) {
      req.firebasePhone = decodedToken.phone_number;
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
  }
};

// Authorize access to a household's dependents. Runs AFTER verifyFirebaseTokenOnly.
// Allowed callers: church staff, the head-of-household / a member of the same
// family, or (read-only) a dependent viewing their own household. Everyone else
// gets 403. This closes the previously-unauthenticated dependents CRUD.
const DEPENDENT_STAFF_ROLES = ['admin', 'secretary', 'church_leadership', 'relationship'];

const rolesOf = (member) => {
  if (!member) return [];
  return (Array.isArray(member.roles) && member.roles.length) ? member.roles : [member.role];
};

const isInHousehold = async (caller, targetMemberId) => {
  if (!caller || targetMemberId == null) return false;
  const effFamilyId = caller.family_id || caller.id;
  if (String(targetMemberId) === String(caller.id)) return true;
  if (String(targetMemberId) === String(effFamilyId)) return true;
  const target = await Member.findByPk(targetMemberId, { attributes: ['id', 'family_id'] });
  return !!target && String(target.family_id || target.id) === String(effFamilyId);
};

const authorizeDependentAccess = async (req, res, next) => {
  try {
    // Resolve the household member this request targets
    let targetMemberId = req.params.memberId || null;
    if (!targetMemberId && req.params.dependentId) {
      const dep = await Dependent.findByPk(req.params.dependentId, {
        attributes: ['id', 'memberId', 'linkedMemberId']
      });
      if (!dep) {
        return res.status(404).json({ success: false, message: 'Dependent not found' });
      }
      targetMemberId = dep.linkedMemberId || dep.memberId;
    }

    // Identify the caller from the verified token (phone-auth only)
    let caller = null;
    if (req.firebaseUid) {
      caller = await Member.findOne({ where: { firebase_uid: req.firebaseUid } });
    }
    if (!caller && req.firebasePhone) {
      caller = await Member.findOne({ where: { phone_number: req.firebasePhone } });
    }

    // Church staff may manage any household's dependents
    if (rolesOf(caller).some((r) => DEPENDENT_STAFF_ROLES.includes(r))) {
      return next();
    }

    // The head-of-household or a member of the same family may manage their own
    if (await isInHousehold(caller, targetMemberId)) {
      return next();
    }

    // A dependent login (no Member record) may READ its own household only
    if (!caller && req.method === 'GET' && req.firebasePhone) {
      const dep = await Dependent.findOne({
        where: { phone: req.firebasePhone },
        attributes: ['memberId', 'linkedMemberId']
      });
      const depHousehold = dep ? (dep.linkedMemberId || dep.memberId) : null;
      if (depHousehold != null && String(depHousehold) === String(targetMemberId)) {
        return next();
      }
    }

    return res.status(403).json({ success: false, message: 'Forbidden' });
  } catch (err) {
    console.error('authorizeDependentAccess error:', err);
    return res.status(500).json({ success: false, message: 'Authorization check failed' });
  }
};

// Public routes
router.post('/register', activityLoggerMiddleware('Member'), validateMemberRegistration, memberController.register);

// Validate head of household phone number
router.get('/validate-head-of-household/:phoneNumber', memberController.validateHeadOfHouseholdPhone);

// Public: check if a phone number already exists (for admin add-member validation)
router.get('/check-phone/:phoneNumber', memberController.checkPhoneExists);
router.get('/check-email/:email', memberController.checkEmailExists);

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

// Firebase Auth profile routes — require a verified Firebase ID token.
// The controllers bind the lookup to the token identity, so a caller can only
// read or update their OWN profile (path :uid must equal the token uid).
router.get('/profile/firebase/:uid', verifyFirebaseTokenOnly, memberController.getProfileByFirebaseUid);
router.put('/profile/firebase/:uid', verifyFirebaseTokenOnly, validateProfileUpdate, memberController.updateProfileByFirebaseUid);

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

// Dependents management routes — require a verified token AND household/staff
// authorization (see authorizeDependentAccess).
router.get('/dependents/count', firebaseAuthMiddleware, roleMiddleware(['admin', 'church_leadership', 'treasurer', 'secretary']), memberController.getTotalDependentsCount);
router.get('/:memberId/dependents', verifyFirebaseTokenOnly, validateMemberId, authorizeDependentAccess, memberController.getMemberDependents);
router.post('/:memberId/dependents', verifyFirebaseTokenOnly, validateMemberId, authorizeDependentAccess, validateDependentData, activityLoggerMiddleware('Dependent'), memberController.addDependent);
router.put('/dependents/:dependentId', verifyFirebaseTokenOnly, validateDependentId, authorizeDependentAccess, validateDependentData, activityLoggerMiddleware('Dependent'), memberController.updateDependent);
router.patch('/dependents/:dependentId', verifyFirebaseTokenOnly, validateDependentId, authorizeDependentAccess, validateDependentUpdate, activityLoggerMiddleware('Dependent'), memberController.updateDependent);
router.delete('/dependents/:dependentId', verifyFirebaseTokenOnly, validateDependentId, authorizeDependentAccess, activityLoggerMiddleware('Dependent'), memberController.deleteDependent);

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

router.get('/onboarding/welcomed',
  roleMiddleware(['admin', 'relationship']),
  memberController.getWelcomedMembers
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

// Member reports (admin only) — must be registered before '/:id'
router.get('/reports/member-information',
  roleMiddleware(['admin']),
  memberReportController.getMemberInformationReport
);

router.get('/reports/household-directory',
  roleMiddleware(['admin']),
  memberReportController.getHouseholdDirectoryReport
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