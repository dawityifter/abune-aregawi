const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { Op } = require('sequelize');
const { Member } = require('../models');
const logger = require('../utils/logger');
const path = require('path');

// Initialize Firebase Admin with better error handling
let firebaseInitialized = false;
try {
  // Force emulator in test environment to avoid initialization errors
  if (process.env.NODE_ENV === 'test') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.log('🔧 Initializing Firebase Admin SDK with service account...');
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    );
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK initialized (service account)');
    } else {
      console.log('ℹ️  Firebase Admin SDK already initialized');
    }
    firebaseInitialized = true;
  } else if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // Initialize Admin SDK for Auth Emulator (no credentials required)
    const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project';
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId });
      console.log(`✅ Firebase Admin SDK initialized for emulator (projectId=${projectId})`);
    } else {
      console.log('ℹ️  Firebase Admin SDK already initialized');
    }
    firebaseInitialized = true;
  } else {
    console.log('⚠️  No Firebase service account or emulator detected. Firebase Admin SDK not initialized.');
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

    if (!member.is_active) {
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
  console.log('\n🔵 ====== START firebaseAuthMiddleware ======');
  console.log(`🔵 Request URL: ${req.method} ${req.originalUrl}`);

  try {
    console.log('🔵 Request Headers:', JSON.stringify(req.headers, null, 2));

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
    console.log('🔵 Authorization header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No Bearer token found in Authorization header');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No Firebase token provided.'
      });
    }
    const firebaseToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔵 Firebase token (first 20 chars):', firebaseToken.substring(0, 20) + '...');

    console.log('🔵 Verifying Firebase token...');

    // Verify Firebase token and extract user info
    let decodedToken;
    try {
      if (process.env.ENABLE_DEMO_MODE === 'true' && firebaseToken === 'MAGIC_DEMO_TOKEN') {
        console.log('✨ Magic Demo Token detected - Bypassing verification');
        console.warn('⚠️  WARNING: Demo mode is enabled. This should NOT be active in production!');
        decodedToken = {
          uid: 'magic-demo-uid',
          phone_number: '+14699078229', // Matches user request
          email: 'demo@admin.com',
          firebase: { sign_in_provider: 'phone' }
        };
      } else {
        decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        console.log('✅ Firebase token verified successfully');
      }
      console.log('🔵 Decoded token data:', JSON.stringify({
        uid: decodedToken.uid,
        email: decodedToken.email,
        phone_number: decodedToken.phone_number,
        phoneNumber: decodedToken.phoneNumber,
        phone: decodedToken.phone
      }, null, 2));
    } catch (verifyError) {
      console.error('❌ Firebase token verification failed:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.'
      });
    }

    const userEmail = decodedToken.email;
    // Check for phone number in different possible fields
    let userPhone = decodedToken.phone_number || decodedToken.phoneNumber || decodedToken.phone;

    // If no phone number in token, try to get it from the user's profile
    if (!userPhone) {
      try {
        const userRecord = await admin.auth().getUser(decodedToken.uid);
        userPhone = userRecord.phoneNumber;
        logger.debug('Got phone number from user profile');
      } catch (profileError) {
        logger.debug('Could not get user profile', profileError.message);
        // If we can't get the phone from profile, check if there's a phone in the request query params
        const requestPhone = req.query.phone;
        if (requestPhone) {
          userPhone = requestPhone;
          logger.debug('Using phone number from request query');
        }
      }
    }

    logger.debug('Firebase token verification summary', {
      email: userEmail,
      phone: userPhone,
      uid: decodedToken.uid
    });

    if (!userEmail && !userPhone) {
      logger.warn('No email or phone found in token', { uid: decodedToken.uid });
      return res.status(401).json({
        success: false,
        message: 'User email not found in Firebase token.'
      });
    }

    // Find member by email or phone
    let member = null;
    if (userEmail) {
      logger.debug('Searching for member by email');
      try {
        member = await Member.findOne({
          where: { email: userEmail }
        });
        logger.debug('Member search by email result', { found: !!member });
      } catch (dbError) {
        logger.error('Database error when searching by email', dbError);
        return res.status(500).json({
          success: false,
          message: 'Database error during authentication.'
        });
      }
    }

    if (!member && userPhone) {
      // Normalize phone number for search
      const normalizedPhone = userPhone.startsWith('+') ? userPhone : `+${userPhone}`;
      logger.debug('Searching for member by phone');
      try {
        member = await Member.findOne({
          where: { phone_number: normalizedPhone }
        });
        logger.debug('Member search by phone result', { found: !!member });
      } catch (dbError) {
        logger.error('Database error when searching by phone', dbError);
        return res.status(500).json({
          success: false,
          message: 'Database error during authentication.'
        });
      }
    }

    if (!member) {
      logger.warn('Member not found during authentication', {
        hasEmail: !!userEmail,
        hasPhone: !!userPhone,
        uid: decodedToken.uid
      });
      return res.status(401).json({
        success: false,
        message: 'Member not found. Please complete your registration first.'
      });
    }

    if (!member.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact the church administrator.'
      });
    }

    // Debug log the member data for troubleshooting
    console.log('🔵 Member data from database:', JSON.stringify({
      id: member.id,
      email: member.email,
      phone_number: member.phone_number,
      role: member.role,
      isActive: member.is_active,
      firstName: member.first_name,
      lastName: member.last_name
    }, null, 2));

    // Note: Do not enforce admin roles here. This middleware authenticates only.
    // Route-level authorization is handled by roleMiddleware on specific routes.

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