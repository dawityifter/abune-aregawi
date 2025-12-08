const { ActivityLog, Member } = require('../models');
const { Op } = require('sequelize');

/**
 * Get activity logs with pagination and filtering
 */
exports.getActivityLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, userId, action, entityType, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        const where = {};

        if (userId) where.user_id = userId;
        if (action) where.action = action;
        if (entityType) where.entity_type = entityType;

        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at[Op.gte] = new Date(startDate);
            if (endDate) where.created_at[Op.lte] = new Date(endDate);
        }

        const { count, rows } = await ActivityLog.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Member,
                    as: 'actor',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ]
        });

        res.json({
            success: true,
            data: {
                logs: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity logs'
        });
    }
};
