import { getMergedPermissions, ROLE_PERMISSIONS, type UserRole, type RolePermissions } from './roles';

/**
 * Which bucket a visitor falls into for analytics. Three coarse groups, never a
 * role name and never an id — enough to keep ~10 staff visiting daily from
 * drowning out ~940 members visiting yearly, and not enough to single anybody out.
 */
export type RoleGroup = 'staff' | 'member' | 'visitor';

/**
 * Staff is defined as "has any permission an ordinary member does not", rather
 * than by a list of role names.
 *
 * A hardcoded staff list would be a second role registry that drifts from
 * roles.ts the moment a role is added — the codebase already has one such drift
 * (deacon and priest exist in the DB role enum but not in UserRole). And no
 * single permission flag is a correct discriminator: the obvious candidate,
 * canViewAllMembers, is false for budget_committee and ap_team, who are plainly
 * staff. Set comparison against the member baseline gets all twelve right with
 * nothing to maintain.
 */
export const resolveRoleGroup = (roles: UserRole[] | null | undefined): RoleGroup => {
  if (!roles || roles.length === 0) return 'visitor';

  const baseline = ROLE_PERMISSIONS.member;
  const merged = getMergedPermissions(roles);

  // Only *extra* permissions make someone staff. `guest` differs from the
  // baseline by having fewer, and must not be misread as elevated.
  const hasExtra = (Object.keys(baseline) as Array<keyof RolePermissions>)
    .some((key) => merged[key] === true && baseline[key] !== true);

  return hasExtra ? 'staff' : 'member';
};
