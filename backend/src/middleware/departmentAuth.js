'use strict';

const { DepartmentMember } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has a specific role in the department
 * @param {Array<string>} roles - List of allowed roles (e.g., ['leader', 'secretary'])
 * @param {boolean} allowGlobalAdmins - Whether global admins/leadership are always allowed (default: true)
 */
const requireDepartmentRole = (roles = [], allowGlobalAdmins = true) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            const departmentId = req.params.id || req.params.departmentId || req.body.department_id;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Check global roles first (if allowed)
            if (allowGlobalAdmins) {
                const globalAdminRoles = ['admin', 'church_leadership'];
                if (globalAdminRoles.includes(user.role)) {
                    return next();
                }
            }

            if (!departmentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Department ID is required for permission check'
                });
            }

            // Check department membership and role
            const membership = await DepartmentMember.findOne({
                where: {
                    department_id: departmentId,
                    member_id: user.member_id,
                    status: 'active'
                }
            });

            if (!membership) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not a member of this department'
                });
            }

            // If no specific roles required, just membership is enough
            if (roles.length === 0) {
                return next();
            }

            // Check if user has one of the required roles
            if (roles.includes(membership.role_in_department)) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'Insufficient department permissions'
            });

        } catch (error) {
            logger.error('Department permission check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during permission check'
            });
        }
    };
};

/**
 * Middleware to check if user is a member of the department (any role)
 */
const requireDepartmentMembership = (allowGlobalAdmins = true) => {
    return requireDepartmentRole([], allowGlobalAdmins);
};

module.exports = {
    requireDepartmentRole,
    requireDepartmentMembership
};
