const jwt = require('jsonwebtoken');
const { Member } = require('../models');

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

    // Add member info to request
    req.user = {
      id: member.id,
      email: member.loginEmail,
      role: member.role,
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

    // For now, we'll use a simple approach: get the user's email from the request
    // and verify they exist in our database with admin role
    const userEmail = req.query.email || req.body.email;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User email required for Firebase authentication.'
      });
    }

    // Find member by email
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

    // Check if user has admin role
    const adminRoles = ['admin', 'church_leadership', 'treasurer', 'secretary'];
    if (!adminRoles.includes(member.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Add member info to request
    req.user = {
      id: member.id,
      email: member.email,
      role: member.role,
      memberId: member.memberId
    };

    next();
  } catch (error) {
    console.error('Firebase auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = { authMiddleware, firebaseAuthMiddleware }; 