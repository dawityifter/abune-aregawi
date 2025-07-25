const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { Op } = require('sequelize');
const { Member } = require('../models');
const path = require('path');

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // ...other config
  });
} else {
  // fallback for local dev, e.g. require('./firebase-service-account.json')
  console.log('No Firebase service account found. ');
}


const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if member exists and is active
    const member = await Member.findByPk(decoded.id);
    
    if (!member) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Member not found.'
      });
    }

    if (!member.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact the church administrator.'
      });
    }

    // Add member info to request - always use fresh role from database
    req.user = {
      id: member.id,
      email: member.email,
      role: member.role, // This is now the fresh role from database
      memberId: member.memberId
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Firebase authentication middleware
const firebaseAuthMiddleware = async (req, res, next) => {
  try {
    // Get Firebase token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No Firebase token provided.'
      });
    }
    const firebaseToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify Firebase token and extract email
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    const userEmail = decodedToken.email;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email not found in Firebase token.'
      });
    }

    // Find member by email (check both email and loginEmail fields)
    const member = await Member.findOne({
      where: { email: userEmail }
    });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: 'Member not found. Please complete your registration first.'
      });
    }
    if (!member.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact the church administrator.'
      });
    }

    // Check if user has admin role (using PostgreSQL role)
    const adminRoles = ['admin', 'church_leadership', 'treasurer', 'secretary'];
    if (!adminRoles.includes(member.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    req.user = {
      id: member.id,
      email: member.email,
      role: member.role,
      memberId: member.memberId
    };

    next();
  } catch (error) {
    console.error('Firebase auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired Firebase token.'
    });
  }
};

module.exports = { authMiddleware, firebaseAuthMiddleware }; 