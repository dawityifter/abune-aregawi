const { logActivity } = require('../utils/activityLogger');

/**
 * Middleware to automatically log modification requests (POST, PUT, DELETE, PATCH)
 * This should be placed AFTER auth middleware so req.user is available
 */
const activityLoggerMiddleware = (entityType) => {
    return (req, res, next) => {
        // Original end function
        const originalEnd = res.end;
        let responseBody;

        // Override end to capture response status and body (optional, for errors)
        res.end = function (chunk, encoding) {
            if (chunk) {
                // Try to capture response body for errors
                // This gives us context on WHY a request failed
                try {
                    const str = chunk.toString();
                    if (str && (res.statusCode >= 400)) {
                        responseBody = str.substring(0, 1000); // Limit size
                    }
                } catch (e) { /* ignore */ }
            }

            // Restore end
            res.end = originalEnd;
            res.end(chunk, encoding);

            // Log modifications (POST, PUT, PATCH, DELETE) OR errors
            const isModification = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
            const isError = res.statusCode >= 400;

            if (isModification || isError) {
                const userId = req.user ? req.user.id : null;
                let action = req.method;

                // Try to infer a more descriptive action
                if (req.method === 'POST') action = 'CREATE';
                if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
                if (req.method === 'DELETE') action = 'DELETE';

                // Try to find entity ID
                const entityId = req.params.id || (req.body && req.body.id) || null;

                // Redact sensitive keys from body
                const sensitiveKeys = ['password', 'confirmPassword', 'token', 'refreshToken', 'creditCard', 'cvv'];
                let sanitizedBody = null;
                if (req.body && typeof req.body === 'object') {
                    sanitizedBody = { ...req.body };
                    sensitiveKeys.forEach(key => {
                        if (key in sanitizedBody) sanitizedBody[key] = '[REDACTED]';
                    });
                    // Also generic loose recursion for nested password fields could be good, but expensive.
                    // keeping it simple for now.
                }

                const details = {
                    method: req.method,
                    url: req.originalUrl,
                    query: req.query,
                    body: sanitizedBody,
                    statusCode: res.statusCode,
                    responseError: isError ? responseBody : null
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
