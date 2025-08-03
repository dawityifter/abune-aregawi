const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { Op } = require('sequelize');
const { Member } = require('../models');
const path = require('path');

// Initialize Firebase Admin with better error handling
let firebaseInitialized = false;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.log('🔧 Initializing Firebase Admin SDK...');
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    );
    
    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      console.log('ℹ️  Firebase Admin SDK already initialized');
    }
    firebaseInitialized = true;
  } else {
    console.log('⚠️  No Firebase service account found. Firebase Admin SDK not initialized.');
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization failed:', error.message);
  console.error('❌ Error details:', error);
  firebaseInitialized = false;
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
    // Check if Firebase Admin is initialized
    if (!firebaseInitialized) {
      console.error('❌ Firebase Admin SDK not initialized');
      return res.status(500).json({
        success: false,
        message: 'Firebase authentication not available. Please contact administrator.'
      });
    }

    // Get Firebase token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No Firebase token provided.'
      });
    }
    const firebaseToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    console.log('🔍 Verifying Firebase token...');
    
    // Verify Firebase token and extract user info
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    const userEmail = decodedToken.email;
    // Check for phone number in different possible fields
    let userPhone = decodedToken.phone_number || decodedToken.phoneNumber || decodedToken.phone;

    // If no phone number in token, try to get it from the user's profile
    if (!userPhone) {
      try {
        const userRecord = await admin.auth().getUser(decodedToken.uid);
        userPhone = userRecord.phoneNumber;
        console.log('📞 Got phone number from user profile');
      } catch (profileError) {
        console.log('⚠️ Could not get user profile:', profileError.message);
        // If we can't get the phone from profile, check if there's a phone in the request query params
        const requestPhone = req.query.phone;
        if (requestPhone) {
          userPhone = requestPhone;
          console.log('📞 Using phone number from request query');
        }
      }
    }

    console.log('✅ Firebase token verified for:', { email: userEmail ? 'present' : 'missing', phone: userPhone ? 'present' : 'missing' });

    if (!userEmail && !userPhone) {
      console.log('❌ No email or phone found in token');
      return res.status(401).json({
        success: false,
        message: 'User email not found in Firebase token.'
      });
    }

    // Find member by email or phone
    let member = null;
    if (userEmail) {
      member = await Member.findOne({
        where: { email: userEmail }
      });
      console.log('🔍 Searching by email:', userEmail);
    }
    
    if (!member && userPhone) {
      // Normalize phone number for search
      const normalizedPhone = userPhone.startsWith('+') ? userPhone : `+${userPhone}`;
      member = await Member.findOne({
        where: { phone_number: normalizedPhone }
      });
      console.log('🔍 Searching by phone:', normalizedPhone);
    }

    if (!member) {
      console.log('❌ Member not found for:', { email: userEmail, phone: userPhone });
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
      console.log('❌ Access denied for user:', userEmail, 'Role:', member.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const identifier = userEmail || userPhone;
    console.log('✅ Firebase auth successful for user:', identifier, 'Role:', member.role);
    console.log('🔍 Setting req.user with:', {
      id: member.id,
      email: member.email,
      role: member.role,
      memberId: member.memberId
    });

    req.user = {
      id: member.id,
      email: member.email,
      role: member.role,
      memberId: member.memberId
    };

    console.log('✅ req.user set successfully:', req.user);
    next();
  } catch (error) {
    console.error('❌ Firebase auth middleware error:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    res.status(401).json({
      success: false,
      message: 'Invalid or expired Firebase token.'
    });
  }
};

module.exports = { authMiddleware, firebaseAuthMiddleware }; 