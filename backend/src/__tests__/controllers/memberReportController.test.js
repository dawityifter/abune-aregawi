'use strict';

jest.mock('../../models', () => ({
  Member: { findAll: jest.fn(), findByPk: jest.fn() },
  Dependent: { findAll: jest.fn() }
}));

const { Member, Dependent } = require('../../models');
const controller = require('../../controllers/memberReportController');

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
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+19725551234', spouse_name: null, family_id: 1, city: 'Dallas' },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: 'Selam Haile', family_id: null, city: 'Garland' },
      // linked member (adult child registered as member) in Abraham's household
      { id: 3, first_name: 'Dawit', last_name: 'Tesfaye', phone_number: '+14695550000', spouse_name: null, family_id: 1, city: 'Dallas' }
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
    expect(tesfaye.dependents[0]).toEqual({ name: 'Samuel Tesfaye', relationship: 'Son', phone: '+14695559876' });
    // Linked member listed under the household
    expect(tesfaye.otherFamilyMembers).toEqual([{ name: 'Dawit Tesfaye', phone: '+14695550000' }]);

    const gebre = data.households[0];
    // Spouse from legacy spouse_name, different last name -> full names joined
    expect(gebre.householdName).toBe('Yonas Gebre & Selam Haile Household');
    expect(gebre.spouse).toEqual({ name: 'Selam Haile', phone: null });

    expect(data.summary).toEqual({
      totalHouseholds: 2,
      totalHeads: 2,
      totalSpouses: 2,
      totalDependents: 3,
      totalParishMembers: 2 + 2 + 3 + 1 // heads + spouses + dependents + linked member
    });
    expect(data.generatedBy).toBe('Admin User');
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
