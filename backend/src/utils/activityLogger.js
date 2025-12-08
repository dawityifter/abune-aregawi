const { ActivityLog } = require('../models');
const logger = require('./logger');

/**
 * Log user activity to the database
 * 
 * @param {Object} params - Activity parameters
 * @param {number|null} params.userId - ID of the user performing the action
 * @param {string} params.action - Action name (e.g., 'CREATE_MEMBER', 'LOGIN')
 * @param {string} params.entityType - Type of entity affected (e.g., 'Member', 'Donation')
 * @param {string|number} params.entityId - ID of the entity
 * @param {Object} params.details - Additional details/metadata
 * @param {Object} params.req - Express request object (optional, for IP/Agent)
 */
const logActivity = async ({
    userId,
    action,
    entityType = null,
    entityId = null,
    details = null,
    req = null
}) => {
    try {
        const ip_address = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
        const user_agent = req ? req.headers['user-agent'] : null;

        await ActivityLog.create({
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId ? String(entityId) : null,
            details,
            ip_address,
            user_agent
        });
    } catch (error) {
        // We don't want to crash the app if logging fails, but we should log the error
        logger.error('Failed to create activity log:', error);
    }
};

module.exports = {
    logActivity
};
