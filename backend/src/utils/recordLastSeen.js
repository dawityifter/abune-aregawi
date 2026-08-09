'use strict';

/**
 * Records that a member was active, so the parish can answer "do members come
 * back?" — a question the anonymous analytics deliberately cannot answer.
 *
 * Two properties matter, and both are about not harming the request:
 *
 *  - Throttled. The auth middleware runs on every authenticated request, so an
 *    unthrottled write would mean ten writes for a member browsing ten screens.
 *  - Fire-and-forget. Never awaited, never throws. Instrumentation that can
 *    break the product is worse than no instrumentation.
 */

const THROTTLE_MS = 60 * 60 * 1000;

const recordLastSeen = (member) => {
  if (!member || typeof member.update !== 'function') return;

  const last = member.lastSeenAt ? new Date(member.lastSeenAt).getTime() : 0;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) return;

  try {
    // Not awaited: the member's response does not wait on a telemetry write.
    // silent:true and no validation keep this from touching updatedAt or
    // running model hooks over an unrelated column.
    const result = member.update(
      { lastSeenAt: new Date() },
      { silent: true, validate: false, fields: ['lastSeenAt'] }
    );
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch (_) {
    // A synchronous throw is as unacceptable as an async one.
  }
};

module.exports = { recordLastSeen, THROTTLE_MS };
