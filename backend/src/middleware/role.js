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

    const userRole = req.user.role;
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [userRole];

    const hasAccess = userRoles.some(role => allowedRoles.includes(role));

    if (!hasAccess) {
      console.log('❌ Access denied - none of user roles in allowed roles:', {
        userRoles,
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