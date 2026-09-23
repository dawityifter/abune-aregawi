'use strict';

/**
 * The two privacy rules the executive dashboard runs on, in one place.
 *
 * Tier 3 may see donor names. It is NOT the same list as pledgeRoutes.js's
 * viewRoles, and deliberately so: bookkeeper and ar_team sit here because
 * editRoles already lets them change and cancel individual pledges, and you
 * cannot cancel a pledge you are not allowed to identify. ap_team holds no
 * edit rights and stays aggregate-only. See spec section 8.
 */
const TIER3_ROLES = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];

/**
 * Below this many pledges, a figure is treated as identifying and withheld
 * from tier 2. At roughly 310 households, "2 pledges over-paid by $340" names
 * someone to anyone who knows the parties.
 */
const SMALL_GROUP_THRESHOLD = 5;

/**
 * Mirrors roleMiddleware's own resolution — array `roles` when present, else
 * the singular `role`. If the two ever disagree about who a user is, the
 * route guard and the payload filter disagree too.
 */
const canSeeDonors = (req) => {
  const user = req?.user;
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [user.role];
  return roles.some((role) => TIER3_ROLES.includes(role));
};

/**
 * Returns `value`, or null when the group behind it is small enough to
 * identify a donor and the caller is not tier 3.
 *
 * A zero-sized group is never suppressed: zero reveals nothing, and blanking
 * it would render as "unknown" when the honest answer is "none".
 */
const suppressSmall = (value, groupSize, canSee) => {
  if (canSee) return value;
  if (groupSize > 0 && groupSize < SMALL_GROUP_THRESHOLD) return null;
  return value;
};

module.exports = { TIER3_ROLES, SMALL_GROUP_THRESHOLD, canSeeDonors, suppressSmall };
