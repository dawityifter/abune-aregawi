/**
 * LOCAL SHADOW MODE ONLY — DO NOT COMMIT
 *
 * Express middleware that:
 *   1. Adds a request correlation ID
 *   2. Intercepts the response JSON to capture Node's response body
 *   3. After Node responds to the client, fires a background comparison
 *      against the Java backend
 *
 * Enabled only when SHADOW_MODE=true
 */

const crypto = require('crypto');
const { shouldShadow, compareInBackground } = require('./shadowCompare');

const ENABLED = process.env.SHADOW_MODE === 'true';

/**
 * Attach a unique requestId to every request.
 * Available as req.requestId regardless of shadow mode.
 */
function requestIdMiddleware(req, _res, next) {
  req.requestId = crypto.randomUUID();
  next();
}

/**
 * Shadow comparison middleware.
 * Intercepts res.json() to capture the response body, then runs
 * a background diff against the Java service. The client always
 * receives the Node response immediately — the Java call is async.
 */
function shadowMiddleware(req, res, next) {
  if (!ENABLED || !shouldShadow(req)) return next();

  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Restore original immediately so any downstream code is unaffected
    res.json = originalJson;

    // Record Node's status for the comparison log
    req._shadowNodeStatus = res.statusCode;

    // Send the Node response to the client right away
    originalJson(body);

    // Fire-and-forget background comparison
    compareInBackground(req, body).catch(() => {});
  };

  next();
}

module.exports = { requestIdMiddleware, shadowMiddleware };
