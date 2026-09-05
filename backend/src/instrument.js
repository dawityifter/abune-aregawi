'use strict';

/**
 * Must be required FIRST — before express, http, routes, controllers, or
 * models — and nothing else may be required above this in server.js.
 *
 * @sentry/node's auto-instrumentation works by patching Node's module loader
 * (require-in-the-middle) so that when a module like 'express' or 'http' is
 * subsequently required, Sentry gets a chance to wrap it. That patch is
 * installed inside Sentry.init(). If express/http are already required (and
 * therefore already cached in Node's module registry) by the time Sentry.init()
 * runs, the hook registers too late: those already-cached modules are handed
 * out unwrapped on every future require(), and Sentry silently stops
 * attaching request context (method, path, status code) and HTTP breadcrumbs
 * to error events. See backend/src/utils/telemetry.js for what happens to
 * those events once they do arrive (path scrubbing, breadcrumb scrubbing).
 *
 * dotenv is loaded here too (idempotent — a second .config() call in
 * server.js is a harmless no-op) so SENTRY_DSN is available no matter which
 * file ends up requiring this one first.
 */
require('dotenv').config();

const { initTelemetry } = require('./utils/telemetry');

// Inert without SENTRY_DSN — a deploy without it behaves exactly as before.
initTelemetry();
