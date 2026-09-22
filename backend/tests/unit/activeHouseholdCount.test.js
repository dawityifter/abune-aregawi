const { Member, sequelize } = require('../../src/models');
const { countActiveHouseholds } = require('../../src/services/pledgeCampaignService');

describe('countActiveHouseholds', () => {
  beforeAll(async () => {
    // No recreatePledgeViews() here on purpose: countActiveHouseholds() queries the
    // members table directly and touches no view.
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Member.destroy({ where: {} });
  });

  const member = async (overrides) => Member.create({
    first_name: 'A', last_name: 'B', is_active: true, role: 'member',
    ...overrides
  });

  it('counts heads of household, not people', async () => {
    const head = await member({
      phone_number: '+15555550130', email: 'h1@example.com',
      firebase_uid: 'uid-h1', family_id: null
    });
    await member({
      phone_number: '+15555550131', email: 's1@example.com',
      firebase_uid: 'uid-s1', family_id: head.id
    });
    await member({
      phone_number: '+15555550132', email: 'h2@example.com',
      firebase_uid: 'uid-h2', family_id: null
    });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(2);
    expect(result.activeMembers).toBe(3);
    expect(result.familyIdPopulated).toBe(true);
  });

  it('counts a self-pointing head once, not zero times', async () => {
    // Both forms of "head" exist in this data: family_id IS NULL, and
    // family_id = own id. memberReportController treats them identically.
    const selfHead = await member({
      phone_number: '+15555550133', email: 'self@example.com',
      firebase_uid: 'uid-self', family_id: null
    });
    await selfHead.update({ family_id: selfHead.id });
    await member({
      phone_number: '+15555550134', email: 'dep@example.com',
      firebase_uid: 'uid-dep', family_id: selfHead.id
    });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(1);
    expect(result.activeMembers).toBe(2);
    // The dependent is genuinely linked; the self-pointing head is not.
    expect(result.familyIdPopulated).toBe(true);
  });

  it('does not treat a self-pointing head as a populated family_id', async () => {
    const solo = await member({
      phone_number: '+15555550135', email: 'solo@example.com',
      firebase_uid: 'uid-solo', family_id: null
    });
    await solo.update({ family_id: solo.id });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(1);
    // family_id is non-null but points at itself — nobody is linked to anybody.
    expect(result.familyIdPopulated).toBe(false);
  });

  it('excludes inactive members from both counts', async () => {
    await member({
      phone_number: '+15555550136', email: 'a@example.com',
      firebase_uid: 'uid-a', family_id: null
    });
    await member({
      phone_number: '+15555550137', email: 'b@example.com',
      firebase_uid: 'uid-b', family_id: null, is_active: false
    });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(1);
    expect(result.activeMembers).toBe(1);
  });

  it('flags an unpopulated family_id so callers can relabel the metric', async () => {
    await member({
      phone_number: '+15555550138', email: 'c@example.com',
      firebase_uid: 'uid-c', family_id: null
    });
    await member({
      phone_number: '+15555550139', email: 'd@example.com',
      firebase_uid: 'uid-d', family_id: null
    });

    const result = await countActiveHouseholds();
    // Every member is an implicit head, so "households" equals "members" and the
    // figure is not really a household count at all.
    expect(result.households).toBe(2);
    expect(result.familyIdPopulated).toBe(false);
  });

  it('returns zeroes on an empty members table', async () => {
    const result = await countActiveHouseholds();
    expect(result).toEqual({ households: 0, activeMembers: 0, familyIdPopulated: false });
  });
});
