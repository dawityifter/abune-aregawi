'use strict';

// scripts/link-household-member.js. All data synthetic.
const { sequelize, Member, Dependent, Transaction } = require('../../src/models');
const { linkHouseholdMember } = require('../../scripts/link-household-member');

describe('link-household-member', () => {
  let head, spouse;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Dependent.destroy({ where: {} });
    await Member.update({ family_id: null }, { where: {} });
    await Member.destroy({ where: {} });
    head = await Member.create({ first_name: 'Head', last_name: 'Sample', phone_number: '+15555550191', is_active: true, yearly_pledge: 600 });
    spouse = await Member.create({ first_name: 'Spouse', last_name: 'Sample', phone_number: '+15555550192', is_active: true, yearly_pledge: 600 });
    await head.update({ family_id: head.id });
    await spouse.update({ family_id: spouse.id });
  });

  const run = async (extra = {}) => {
    const t = await sequelize.transaction();
    try {
      const log = await linkHouseholdMember({ headId: head.id, memberId: spouse.id, ...extra }, t);
      await t.commit();
      return log;
    } catch (e) { await t.rollback(); throw e; }
  };

  it('puts the member in the head\'s household and zeroes their dues pledge', async () => {
    const log = (await run()).join('\n');
    await head.reload(); await spouse.reload();
    expect(String(head.family_id)).toBe(String(head.id));
    expect(String(spouse.family_id)).toBe(String(head.id));
    expect(Number(spouse.yearly_pledge)).toBe(0);
    expect(Number(head.yearly_pledge)).toBe(600);
    expect(log).toMatch(/household of Head Sample .*: Head Sample, Spouse Sample — dues pledge 600.00\/yr/);
  });

  it('moves the member\'s own household members and dependents to the head', async () => {
    const child = await Member.create({ first_name: 'Child', last_name: 'Sample', phone_number: '+15555550193', is_active: true, family_id: spouse.id });
    // Ordinary dependents carry their household's member in linkedMemberId.
    const dep = await Dependent.create({ memberId: spouse.id, linkedMemberId: spouse.id, firstName: 'Kid', lastName: 'Sample', relationship: 'Son', gender: 'male', dateOfBirth: '2015-01-01' });
    await run();
    expect(String((await child.reload()).family_id)).toBe(String(head.id));
    await dep.reload();
    expect(String(dep.memberId)).toBe(String(head.id));
    expect(String(dep.linkedMemberId)).toBe(String(head.id));
    // The kid is not mistaken for the spouse: the spouse gets a row of their own.
    const spouseRow = await Dependent.findOne({ where: { memberId: head.id, linkedMemberId: spouse.id } });
    expect(spouseRow.firstName).toBe('Spouse');
  });

  it('lists the member in the head\'s dependents as Spouse, linked to their member record', async () => {
    await spouse.update({ email: 'spouse@example.com', gender: 'female' });
    await run();
    const rows = await Dependent.findAll({ where: { memberId: head.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      firstName: 'Spouse', lastName: 'Sample', relationship: 'Spouse',
      phone: '+15555550192', email: 'spouse@example.com', gender: 'female'
    });
    expect(String(rows[0].linkedMemberId)).toBe(String(spouse.id));
  });

  it('links an existing dependent row for the member instead of duplicating it', async () => {
    const pre = await Dependent.create({ memberId: head.id, linkedMemberId: head.id, firstName: 'spouse', lastName: 'SAMPLE', relationship: 'Spouse' });
    const log = (await run()).join('\n');
    expect(await Dependent.count({ where: { memberId: head.id } })).toBe(1);
    expect(String((await pre.reload()).linkedMemberId)).toBe(String(spouse.id));
    expect(log).toMatch(/linked to Spouse Sample/);
  });

  it('takes a relationship other than Spouse, and rejects an unknown one', async () => {
    await run({ relationship: 'Parent' });
    expect((await Dependent.findOne({ where: { linkedMemberId: spouse.id } })).relationship).toBe('Parent');
    await expect(run({ relationship: 'Cousin' })).rejects.toThrow(/--relationship must be one of/);
  });

  it('counts both people\'s dues payments toward the household', async () => {
    await Transaction.create({ member_id: spouse.id, collected_by: head.id, amount: 50, payment_date: '2026-09-01', payment_type: 'membership_due', payment_method: 'cash', status: 'succeeded', receipt_number: '1' });
    const log = (await run()).join('\n');
    expect(log).toMatch(/1 membership dues payment\(s\) counted/);
  });

  it('--keep-pledge leaves the member\'s pledge', async () => {
    await run({ keepPledge: true });
    expect(Number((await spouse.reload()).yearly_pledge)).toBe(600);
  });

  it('is safe to run twice', async () => {
    await run();
    const log = (await run()).join('\n');
    expect(log).toMatch(/already in Head Sample/);
    expect(log).not.toMatch(/->/);
  });

  it('refuses a head who is in someone else\'s household', async () => {
    const other = await Member.create({ first_name: 'Other', last_name: 'Head', phone_number: '+15555550194', is_active: true });
    await head.update({ family_id: other.id });
    await expect(run()).rejects.toThrow(/use that member as --head/);
    expect(String((await spouse.reload()).family_id)).toBe(String(spouse.id));
  });

  it('a rolled-back run (dry run) changes nothing', async () => {
    const t = await sequelize.transaction();
    await linkHouseholdMember({ headId: head.id, memberId: spouse.id }, t);
    await t.rollback();
    expect(String((await spouse.reload()).family_id)).toBe(String(spouse.id));
    expect(Number(spouse.yearly_pledge)).toBe(600);
  });
});
