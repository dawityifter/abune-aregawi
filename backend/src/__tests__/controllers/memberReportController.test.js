'use strict';

jest.mock('../../models', () => ({
  Member: { findAll: jest.fn(), findByPk: jest.fn() },
  Dependent: { findAll: jest.fn() }
}));

const { Member, Dependent } = require('../../models');
const controller = require('../../controllers/memberReportController');

// Mirrors the controller's age formula so expected ages never go stale —
// computed relative to whatever "today" the test actually runs on. Parses
// the YYYY-MM-DD components directly (no `new Date(dob)` + local getters)
// so this can't hide the same UTC-offset-shifts-the-day bug it's meant to
// catch.
const expectedAge = (dob) => {
  const [year, month, day] = String(dob).slice(0, 10).split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = (today.getMonth() + 1) - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return age;
};

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('memberReportController.getMemberInformationReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prefers spouse dependents over spouse_name and falls back to parsing spouse_name', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+19725551234', spouse_name: 'Old Name' },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: 'Selam Gebre' }
    ]);
    Dependent.findAll.mockResolvedValue([
      { memberId: 1, firstName: 'Hana', lastName: 'Tesfaye', phone: '+19725555678' }
    ]);

    const res = mockRes();
    await controller.getMemberInformationReport({ query: {} }, res);

    expect(Member.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { is_active: true }
    }));
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.reportType).toBe('member_information');
    expect(payload.data.totalActiveMembers).toBe(2);
    expect(payload.data.members[0]).toEqual(expect.objectContaining({
      spouse_first_name: 'Hana', spouse_last_name: 'Tesfaye', spouse_phone: '+19725555678'
    }));
    expect(payload.data.members[1]).toEqual(expect.objectContaining({
      spouse_first_name: 'Selam', spouse_last_name: 'Gebre', spouse_phone: null
    }));
  });
});

describe('memberReportController.getHouseholdDirectoryReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Member.findByPk.mockResolvedValue({ first_name: 'Admin', last_name: 'User' });
  });

  const req = (query = {}, user = { id: 99, email: 'a@b.c' }) => ({ query, user });

  it('groups households, sorts by head last/first name, and builds names', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+19725551234', spouse_name: null, family_id: 1, city: 'Dallas', date_of_birth: null },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: 'Selam Haile', family_id: null, city: 'Garland', date_of_birth: null },
      // linked member (adult child registered as member) in Abraham's household, with a DOB on file
      { id: 3, first_name: 'Dawit', last_name: 'Tesfaye', phone_number: '+14695550000', spouse_name: null, family_id: 1, city: 'Dallas', date_of_birth: '2005-09-10' },
      // registered separately but also recorded as Yonas's spouse -> must not double-list
      { id: 4, first_name: 'selam', last_name: 'HAILE', phone_number: '+19725550001', spouse_name: null, family_id: 2, city: 'Garland', date_of_birth: null }
    ]);
    Dependent.findAll.mockResolvedValue([
      { memberId: 1, firstName: 'Hana', lastName: 'Tesfaye', relationship: 'Spouse', phone: null, dateOfBirth: null },
      { memberId: 1, firstName: 'Ruth', lastName: 'Tesfaye', relationship: 'Daughter', phone: null, dateOfBirth: '2012-05-01' },
      { memberId: 1, firstName: 'Samuel', lastName: 'Tesfaye', relationship: 'Son', phone: '+14695559876', dateOfBirth: '2008-03-02' },
      { memberId: 1, firstName: 'Zara', lastName: 'Tesfaye', relationship: 'Daughter', phone: null, dateOfBirth: null }
    ]);

    const res = mockRes();
    await controller.getHouseholdDirectoryReport(req(), res);
    const { data } = res.json.mock.calls[0][0];

    // Sorted: Gebre before Tesfaye
    expect(data.households.map((h) => h.headId)).toEqual([2, 1]);

    const tesfaye = data.households[1];
    // Spouse shares last name -> "First & SpouseFirst Last Household"
    expect(tesfaye.householdName).toBe('Abraham & Hana Tesfaye Household');
    expect(tesfaye.spouse).toEqual({ name: 'Hana Tesfaye', phone: null });
    // Dependents: DOB ascending (oldest first), missing DOB last alphabetically
    expect(tesfaye.dependents.map((d) => d.name)).toEqual(['Samuel Tesfaye', 'Ruth Tesfaye', 'Zara Tesfaye']);
    expect(tesfaye.dependents[0]).toEqual({
      name: 'Samuel Tesfaye', relationship: 'Son', phone: '+14695559876', age: expectedAge('2008-03-02')
    });
    // Dependent with no DOB on file -> age is null, never omitted
    expect(tesfaye.dependents[2]).toEqual({ name: 'Zara Tesfaye', relationship: 'Daughter', phone: null, age: null });
    // Linked member listed under the household, with computed age from their DOB
    expect(tesfaye.otherFamilyMembers).toEqual([
      { name: 'Dawit Tesfaye', phone: '+14695550000', age: expectedAge('2005-09-10') }
    ]);

    const gebre = data.households[0];
    // Spouse from legacy spouse_name, different last name -> full names joined
    expect(gebre.householdName).toBe('Yonas Gebre & Selam Haile Household');
    expect(gebre.spouse).toEqual({ name: 'Selam Haile', phone: null });
    // Member 4 ("selam HAILE") is a case-insensitive name match for the spouse
    // ("Selam Haile") -> excluded from otherFamilyMembers, not double-listed
    expect(gebre.otherFamilyMembers).toEqual([]);

    expect(data.summary).toEqual({
      totalHouseholds: 2,
      totalHeads: 2,
      totalSpouses: 2,
      totalDependents: 3,
      totalParishMembers: 2 + 2 + 3 + 1 // heads + spouses + dependents + linked member (spouse duplicate excluded)
    });
    expect(data.generatedBy).toBe('Admin User');

    // PII rule: no raw date of birth anywhere in the response payload
    expect(JSON.stringify(data)).not.toMatch(/dateOfBirth|date_of_birth/);
  });

  it('applies filters: active-only default, membership_status in query, head last_name/city in JS', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: null, spouse_name: null, family_id: null, city: 'Dallas' },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: null, family_id: null, city: 'Garland' }
    ]);
    Dependent.findAll.mockResolvedValue([]);

    const res = mockRes();
    await controller.getHouseholdDirectoryReport(req({ last_name: 'tes', city: 'dal', membership_status: 'complete' }), res);

    expect(Member.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { is_active: true, registration_status: 'complete' }
    }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.households).toHaveLength(1);
    expect(data.households[0].headId).toBe(1);
  });

  it('omits the is_active filter when include_inactive=true and handles no spouse', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: null, spouse_name: null, family_id: null, city: null }
    ]);
    Dependent.findAll.mockResolvedValue([]);

    const res = mockRes();
    await controller.getHouseholdDirectoryReport(req({ include_inactive: 'true' }), res);

    expect(Member.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.households[0].householdName).toBe('Abraham Tesfaye Household');
    expect(data.households[0].spouse).toBeNull();
    expect(data.summary.totalSpouses).toBe(0);
  });
});

describe('admin-only role gate for member reports', () => {
  const roleMiddleware = require('../../middleware/role');

  it('rejects non-admin roles with 403 and accepts admin', () => {
    const gate = roleMiddleware(['admin']);
    const next = jest.fn();

    const resDenied = mockRes();
    gate({ user: { role: 'treasurer', roles: ['treasurer'] }, originalUrl: '/api/members/reports/household-directory' }, resDenied, next);
    expect(resDenied.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    const resAllowed = mockRes();
    gate({ user: { role: 'admin', roles: ['admin'] }, originalUrl: '/api/members/reports/household-directory' }, resAllowed, next);
    expect(next).toHaveBeenCalled();
  });
});
