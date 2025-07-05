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

module.exports = authMiddleware; 