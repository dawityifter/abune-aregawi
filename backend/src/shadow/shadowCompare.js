/**
 * LOCAL SHADOW MODE ONLY — DO NOT COMMIT
 *
 * Forwards GET requests to the Java backend in the background,
 * compares JSON responses, and writes structured diffs to log files.
 *
 * Controlled by:
 *   SHADOW_MODE=true
 *   JAVA_SHADOW_BASE=http://localhost:8080  (default)
 */

const axios = require('axios');
const { diff } = require('deep-diff');
const fs = require('fs');
const path = require('path');

const REPORT_LOG = path.resolve(__dirname, '../../shadow-report.log');
const ERROR_LOG = path.resolve(__dirname, '../../shadow-errors.log');

const JAVA_BASE = process.env.JAVA_SHADOW_BASE || 'http://localhost:8080';
const TIMEOUT_MS = 3000;

// Hop-by-hop headers that must not be forwarded
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length',
]);

/**
 * Routes eligible for shadow comparison (GET only).
 * Add or remove paths here to control scope.
 */
const SHADOW_ALLOWLIST = [
  '/api/members',
  '/api/payments',
  '/api/transactions',
  '/api/expenses',
  '/api/departments',
  '/api/pledges',
  '/api/income-categories',
  '/api/employees',
  '/api/vendors',
  '/api/bank',
  '/api/volunteers',
  '/api/loans',
];

/** Check if this request should be shadowed */
function shouldShadow(req) {
  if (req.method !== 'GET') return false;
  return SHADOW_ALLOWLIST.some(prefix => req.originalUrl.startsWith(prefix));
}

/** Strip hop-by-hop headers and return a clean header object */
function forwardHeaders(reqHeaders) {
  const cleaned = {};
  for (const [key, val] of Object.entries(reqHeaders)) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Recursively sort object keys so field order doesn't cause false diffs.
 */
function normalize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalize);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = normalize(obj[key]);
    }
    return sorted;
  }
  return obj;
}

/** Append a JSON line to a log file (fire-and-forget). */
function appendLog(filePath, data) {
  const line = JSON.stringify(data) + '\n';
  fs.appendFile(filePath, line, (err) => {
    if (err) console.error('[shadow] log write error:', err.message);
  });
}

/**
 * Fire-and-forget: call Java backend with same request,
 * compare responses, and write results to log files.
 */
async function compareInBackground(req, nodeBody) {
  const requestId = req.requestId || 'unknown';
  const fullPath = req.originalUrl; // includes query string

  try {
    const javaRes = await axios({
      method: 'GET',
      url: `${JAVA_BASE}${fullPath}`,
      headers: forwardHeaders(req.headers),
      timeout: TIMEOUT_MS,
      validateStatus: () => true, // accept any status
    });

    const nodeNorm = normalize(nodeBody);
    const javaNorm = normalize(javaRes.data);

    const differences = diff(nodeNorm, javaNorm) || [];

    const entry = {
      time: new Date().toISOString(),
      method: 'GET',
      path: fullPath,
      nodeStatus: req._shadowNodeStatus,
      javaStatus: javaRes.status,
      match: differences.length === 0,
      diffCount: differences.length,
      differences: differences.slice(0, 20), // cap for readability
      requestId,
    };

    appendLog(REPORT_LOG, entry);
  } catch (err) {
    appendLog(ERROR_LOG, {
      time: new Date().toISOString(),
      method: 'GET',
      path: fullPath,
      error: err.message,
      code: err.code || null,
      requestId,
    });
  }
}

module.exports = { shouldShadow, compareInBackground };
