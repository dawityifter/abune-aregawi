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
