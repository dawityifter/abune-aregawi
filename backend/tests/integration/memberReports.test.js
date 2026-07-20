const request = require('supertest');
const app = require('../../src/server');
const { Member, Dependent, sequelize } = require('../../src/models');

describe('Member reports', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Dependent.destroy({ where: {} });
    await Member.destroy({ where: {} });
  });

  // Authenticated caller (matches the firebase mock in tests/setup.js)
  const createCaller = (role) =>
    Member.create({
      first_name: 'Test',
      last_name: 'Caller',
      email: 'test@example.com',
      firebase_uid: 'test-firebase-uid',
      phone_number: '+15550000001',
      role,
      is_active: true
    });

  describe('GET /api/payments/reports/member_information (legacy fallthrough)', () => {
    it('returns 400 for an authenticated treasurer — only summary report is supported', async () => {
      await createCaller('treasurer');

      const res = await request(app)
        .get('/api/payments/reports/member_information')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Only summary report is supported currently');
    });
  });

  describe('GET /api/members/reports/member-information', () => {
    it('returns 403 for an authenticated treasurer (admin-only route)', async () => {
      await createCaller('treasurer');

      const res = await request(app)
        .get('/api/members/reports/member-information')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('sources spouse contact from the Spouse dependent, falls back to spouse_name, excludes inactive (admin caller)', async () => {
      await createCaller('admin');

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
        .get('/api/members/reports/member-information')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body.success).toBe(true);
      const { data } = res.body;
      expect(data.reportType).toBe('member_information');
      // Admin caller + two active members; the inactive one is excluded
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

  describe('GET /api/members/reports/household-directory', () => {
    it('returns 200 for an admin caller with a household summary', async () => {
      await createCaller('admin');

      const head = await Member.create({
        first_name: 'Mulubirhan',
        last_name: 'Zerihun',
        phone_number: '+12145550108',
        city: 'Irving',
        is_active: true
      });
      await Dependent.create({
        memberId: head.id,
        firstName: 'Senait',
        lastName: 'Reda',
        relationship: 'Spouse',
        phone: '+14695550170',
        gender: 'Female'
      });
      await Dependent.create({
        memberId: head.id,
        firstName: 'Nardos',
        lastName: 'Zerihun',
        relationship: 'Daughter',
        dateOfBirth: '2015-04-01'
      });

      const res = await request(app)
        .get('/api/members/reports/household-directory')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(res.body.success).toBe(true);
      const { data } = res.body;
      expect(data.reportType).toBe('household_directory');
      expect(data.summary.totalHouseholds).toBeGreaterThan(0);

      const household = data.households.find((h) => String(h.headId) === String(head.id));
      expect(household).toBeTruthy();
      expect(household.spouse).toMatchObject({ name: 'Senait Reda', phone: '+14695550170' });
      expect(household.dependents).toEqual([
        { name: 'Nardos Zerihun', relationship: 'Daughter', phone: null }
      ]);
    });
  });
});
