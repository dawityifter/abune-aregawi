'use strict';
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { downloadStatement, emailStatement } = require('../controllers/statementController');

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

// GET /api/members/statement/pdf?year=YYYY
router.get('/pdf', verifyFirebaseTokenOnly, downloadStatement);

// POST /api/members/statement/email   body: { year }
router.post('/email', verifyFirebaseTokenOnly, emailStatement);

module.exports = router;
