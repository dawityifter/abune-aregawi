import { resolveRoleGroup } from '../roleGroup';
import type { UserRole } from '../roles';

describe('resolveRoleGroup', () => {
  it('treats a signed-out visitor as visitor', () => {
    expect(resolveRoleGroup(null)).toBe('visitor');
    expect(resolveRoleGroup(undefined)).toBe('visitor');
    expect(resolveRoleGroup([])).toBe('visitor');
  });

  it('treats a plain member as member', () => {
    expect(resolveRoleGroup(['member'])).toBe('member');
  });

  it('treats guest as visitor-equivalent, not staff', () => {
    // guest has strictly fewer permissions than member, so it must not be
    // mistaken for "differs from baseline, therefore staff".
    expect(resolveRoleGroup(['guest'])).toBe('member');
  });

  it('classifies every staff role as staff', () => {
    const staffRoles: UserRole[] = [
      'admin', 'church_leadership', 'treasurer', 'bookkeeper',
      'budget_committee', 'auditor', 'ar_team', 'ap_team',
      'relationship', 'secretary',
    ];
    staffRoles.forEach((role) => {
      expect(resolveRoleGroup([role])).toBe('staff');
    });
  });

  it('classifies a multi-role member by the union of their permissions', () => {
    expect(resolveRoleGroup(['member', 'treasurer'])).toBe('staff');
    expect(resolveRoleGroup(['member', 'guest'])).toBe('member');
  });
});
