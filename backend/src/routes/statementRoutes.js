'use strict';
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const { downloadStatement, emailStatement, downloadStatementForMember } = require('../controllers/statementController');

// Inline Firebase-token-only middleware (same pattern as memberRoutes.js)
const verifyFirebaseTokenOnly = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No Firebase token provided.' });
    }
    const token = authHeader.substring(7);
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUid = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
  }
};

// GET /api/members/statement/pdf?year=YYYY  (member downloads their own)
router.get('/pdf', verifyFirebaseTokenOnly, downloadStatement);

// POST /api/members/statement/email   body: { year }
router.post('/email', verifyFirebaseTokenOnly, emailStatement);

// Role guard for admin/treasurer routes
const requireAdminOrTreasurer = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'treasurer') return next();
  return res.status(403).json({ message: 'Access denied. Admin or Treasurer role required.' });
};

// GET /api/members/statement/pdf/for-member?memberId=X&year=YYYY  (admin/treasurer downloads for a member)
router.get('/pdf/for-member', firebaseAuthMiddleware, requireAdminOrTreasurer, downloadStatementForMember);

module.exports = router;
