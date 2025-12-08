const { logActivity } = require('../utils/activityLogger');

/**
 * Middleware to automatically log modification requests (POST, PUT, DELETE, PATCH)
 * This should be placed AFTER auth middleware so req.user is available
 */
const activityLoggerMiddleware = (entityType) => {
    return (req, res, next) => {
        // Original end function
        const originalEnd = res.end;

        // Override end to capture response status
        res.end = function (chunk, encoding) {
            // Restore end
            res.end = originalEnd;
            res.end(chunk, encoding);

            // Only log successful modifications (2xx status codes)
            // and only for modification methods (skip GET/HEAD/OPTIONS unless strictly configured)
            const isModification = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
            const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

            if (isModification && isSuccess) {
                const userId = req.user ? req.user.id : null;
                let action = req.method;

                // Try to infer a more descriptive action
                if (req.method === 'POST') action = 'CREATE';
                if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
                if (req.method === 'DELETE') action = 'DELETE';

                // Try to find entity ID
                const entityId = req.params.id || (req.body && req.body.id) || null;

                // Capture relevant details (exclude password/sensitive fields if any)
                // We'll trust the safe logging practices or rely on specific redaction if needed later
                // For now, minimal details: method, url
                const details = {
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode
                };

                // Fire and forget logging
                logActivity({
                    userId,
                    action,
                    entityType: entityType || 'Unknown',
                    entityId,
                    details,
                    req
                });
            }
        };

        next();
    };
};

module.exports = activityLoggerMiddleware;
