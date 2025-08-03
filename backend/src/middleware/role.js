const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    console.log('🔍 Role middleware check for route:', req.originalUrl);
    console.log('🔍 Role middleware check:', {
      hasUser: !!req.user,
      userRole: req.user?.role,
      allowedRoles,
      userDetails: req.user
    });

    if (!req.user) {
      console.log('❌ No user found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ Access denied - user role not in allowed roles:', {
        userRole: req.user.role,
        allowedRoles
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    console.log('✅ Role check passed for user:', req.user.role);
    next();
  };
};

module.exports = roleMiddleware; 