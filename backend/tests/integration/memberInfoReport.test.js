const request = require('supertest');
const app = require('../../src/server');
const { Member, Dependent, sequelize } = require('../../src/models');

describe('Member Information report', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Dependent.destroy({ where: {} });
    await Member.destroy({ where: {} });

    // Authenticated caller (matches the firebase mock in tests/setup.js)
    await Member.create({
      first_name: 'Test',
      last_name: 'Treasurer',
      email: 'test@example.com',
      firebase_uid: 'test-firebase-uid',
      phone_number: '+15550000001',
      role: 'treasurer',
      is_active: true
    });
  });

  it('sources spouse contact from the Spouse dependent, falls back to spouse_name, excludes inactive', async () => {
    // Spouse recorded properly as a dependent (relationship = Spouse)
    const withSpouseDep = await Member.create({
      first_name: 'Mulubirhan',
      last_name: 'Zerihun',
      phone_number: '+12145550108',
      spouse_name: 'STALE NAME', // dependent row must win over this
      is_active: true
    });
    await Dependent.create({
      memberId: withSpouseDep.id,
      firstName: 'Senait',
      lastName: 'Reda',
      relationship: 'Spouse',
      phone: '+14695550170',
      gender: 'Female'
    });

    // Legacy member: only the free-text spouse_name, no dependent row
    const legacy = await Member.create({
      first_name: 'Berhane',
      last_name: 'Woldu',
      phone_number: '+19725550163',
      spouse_name: 'Tsehay Mebrahtu Gebre',
      is_active: true
    });

    await Member.create({
      first_name: 'Gone',
      last_name: 'Inactive',
      phone_number: '+15550000009',
      is_active: false
    });

    const res = await request(app)
      .get('/api/payments/reports/member_information')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(res.body.success).toBe(true);
    const { data } = res.body;
    expect(data.reportType).toBe('member_information');
    // Treasurer + two active members; the inactive one is excluded
    expect(data.totalActiveMembers).toBe(3);

    const depRow = data.members.find((m) => String(m.id) === String(withSpouseDep.id));
    expect(depRow).toMatchObject({
      first_name: 'Mulubirhan',
      last_name: 'Zerihun',
      phone_number: '+12145550108',
      spouse_first_name: 'Senait',
      spouse_last_name: 'Reda',
      spouse_phone: '+14695550170'
    });

    // Fallback splits spouse_name on the first space; no phone available
    const legacyRow = data.members.find((m) => String(m.id) === String(legacy.id));
    expect(legacyRow).toMatchObject({
      spouse_first_name: 'Tsehay',
      spouse_last_name: 'Mebrahtu Gebre',
      spouse_phone: null
    });

    // Ordered by id ascending
    const ids = data.members.map((m) => Number(m.id));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
