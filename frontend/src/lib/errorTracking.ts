import * as Sentry from '@sentry/react';
import type { ErrorEvent as SentryEvent } from '@sentry/react';
import { stripIdentifiers } from '../utils/analytics';

/**
 * Error reporting, held to the same standard as analytics: inert without its
 * env var, silent in development, and it never sends anything that could
 * identify a member.
 */

const DSN = process.env.REACT_APP_SENTRY_DSN;

export const isErrorTrackingEnabled = (): boolean => {
  if (!DSN) return false;
  if (process.env.NODE_ENV !== 'production') return false;
  // Matches initAnalytics(): a member who asked not to be tracked is not
  // tracked by the error reporter either.
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return false;
  return true;
};

/**
 * The only interesting part of this module: what refuses to leave the browser.
 * Exported so it can be tested directly rather than through Sentry's client.
 */
export const scrubEvent = (event: SentryEvent): SentryEvent | null => {
  // Every deploy produces a burst of these from clients holding a stale asset
  // manifest. lazyWithRecovery.ts and ErrorBoundary already detect and recover
  // from them by design, so reporting them would bury real errors under known,
  // self-healing noise.
  const type = event.exception?.values?.[0]?.type;
  if (type === 'ChunkLoadError') return null;

  // No user identity, ever.
  delete event.user;

  if (event.request) {
    if (event.request.url) {
      // Reuses the analytics stripper so there is one implementation of "what
      // counts as an identifier", not two that drift apart.
      let path = event.request.url;
      try {
        path = new URL(event.request.url).pathname;
      } catch {
        // Already a bare path, or unparseable — strip it as-is.
      }
      event.request.url = stripIdentifiers(path);
    }
    // Headers carry session cookies and bearer tokens; the body carries dues
    // amounts and member records. Neither has diagnostic value worth the risk.
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
  }

  delete event.extra;

  return event;
};

export const initErrorTracking = (): void => {
  if (!isErrorTrackingEnabled()) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    // Errors only. Performance tracing would sample real navigations and is not
    // what this work is for.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
};

/**
 * Report a caught error. Wrapped so a failure inside error *reporting* can
 * never break error *display* — ErrorBoundary is the app's crash fallback and
 * must not throw.
 */
export const reportError = (error: Error, context?: Record<string, unknown>): void => {
  if (!isErrorTrackingEnabled()) return;
  try {
    Sentry.captureException(error, context ? { tags: context as Record<string, string> } : undefined);
  } catch {
    // Reporting is best-effort by definition.
  }
};
