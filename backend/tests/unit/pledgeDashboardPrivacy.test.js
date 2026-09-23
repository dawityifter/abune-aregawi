const {
  TIER3_ROLES, SMALL_GROUP_THRESHOLD, canSeeDonors, suppressSmall
} = require('../../src/services/pledgeDashboardPrivacy');

describe('pledge dashboard privacy rules', () => {
  describe('canSeeDonors', () => {
    it('admits the four tier-3 roles', () => {
      ['admin', 'treasurer', 'bookkeeper', 'ar_team'].forEach((role) => {
        expect(canSeeDonors({ user: { roles: [role] } })).toBe(true);
      });
    });

    it('refuses ap_team, which has no pledge edit rights', () => {
      expect(canSeeDonors({ user: { roles: ['ap_team'] } })).toBe(false);
    });

    it('refuses the other aggregate-only view roles', () => {
      ['church_leadership', 'secretary', 'auditor', 'budget_committee'].forEach((role) => {
        expect(canSeeDonors({ user: { roles: [role] } })).toBe(false);
      });
    });

    it('admits a user whose tier-3 role is one of several', () => {
      expect(canSeeDonors({ user: { roles: ['secretary', 'treasurer'] } })).toBe(true);
    });

    // roleMiddleware falls back to the singular `role` when `roles` is absent;
    // mirror that exactly or the two disagree about who a user is.
    it('falls back to the singular role field', () => {
      expect(canSeeDonors({ user: { role: 'treasurer' } })).toBe(true);
      expect(canSeeDonors({ user: { role: 'ap_team' } })).toBe(false);
    });

    it('refuses an unauthenticated request', () => {
      expect(canSeeDonors({})).toBe(false);
      expect(canSeeDonors({ user: null })).toBe(false);
    });
  });

  describe('suppressSmall', () => {
    it('blanks a figure drawn from fewer than five pledges', () => {
      expect(suppressSmall(340, 2, false)).toBeNull();
      expect(suppressSmall(340, 4, false)).toBeNull();
    });

    it('keeps a figure at the threshold and above', () => {
      expect(suppressSmall(340, 5, false)).toBe(340);
      expect(suppressSmall(340, 47, false)).toBe(340);
    });

    // Zero identifies nobody, and blanking it would read as "unknown" when the
    // true answer is "none" — the exact confusion spec section 11 warns about.
    it('never blanks a zero-sized group', () => {
      expect(suppressSmall(0, 0, false)).toBe(0);
    });

    it('returns the value untouched for a tier-3 caller', () => {
      expect(suppressSmall(340, 2, true)).toBe(340);
    });

    it('applies to counts as well as amounts', () => {
      expect(suppressSmall(3, 3, false)).toBeNull();
    });
  });

  it('exports the threshold so no caller hardcodes 5', () => {
    expect(SMALL_GROUP_THRESHOLD).toBe(5);
    expect(TIER3_ROLES).toEqual(['admin', 'treasurer', 'bookkeeper', 'ar_team']);
  });
});
