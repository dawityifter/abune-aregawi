/**
 * Puts a separately registered member (typically a spouse) into another
 * member's household, with that member as head of household.
 *
 * A household is members.family_id: the head's is null or their own id, and
 * everyone else in the household holds the head's id. Dues, giving statements,
 * the household directory and pledge-drive household counts all group on it.
 *
 * What it changes:
 *   - the head's family_id is set to their own id (the explicit form)
 *   - the member's family_id -> the head
 *   - anyone who was in the MEMBER's household (their family_id pointed at the
 *     member) moves to the head, and so do the member's dependents
 *   - the member is listed in the head's Dependents (relationship --relationship,
 *     default Spouse), linked to their own member record — the same shape the
 *     app's "promote dependent to member" flow leaves, and that the existing
 *     linked spouses have. An existing row for them under the head (matched by
 *     link, phone or name) is linked rather than duplicated. Their own login
 *     is unaffected: sign-in resolves a member record before any dependent.
 *   - the member's yearly_pledge -> 0: household dues use the head's pledge,
 *     and totals that add every member's pledge would otherwise count the
 *     household twice. Every existing linked member follows this convention.
 *     --keep-pledge leaves it.
 *
 * It changes no payments: dues payments by either person already count toward
 * the household once linked, because dues sum over all household members.
 *
 * It refuses when the head is themselves in someone else's household (link to
 * that household's real head instead).
 *
 * One database transaction; a dry run performs the changes and rolls back, so
 * its output is exactly what --apply will do.
 *
 * From backend/:
 *   node scripts/link-household-member.js --head 510 --member 138
 *   node scripts/link-household-member.js --head 510 --member 138 --apply
 *   (--relationship Son|Daughter|Parent|Sibling|Other for someone other than a spouse)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const { sequelize, Member, Dependent, Transaction } = require('../src/models');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = (m) => `${m.first_name} ${m.last_name} (#${m.id})`;
const isHead = (m) => !m.family_id || String(m.family_id) === String(m.id);
const money = (v) => Number(v || 0).toFixed(2);

/** The change itself, inside the caller's transaction `t`. Exported for tests. */
async function linkHouseholdMember({ headId, memberId, keepPledge = false, relationship = 'Spouse' }, t) {
  const log = [];
  const opt = { transaction: t };

  if (String(headId) === String(memberId)) throw new Error('--head and --member are the same member');
  if (!Object.values(Dependent.RELATIONSHIP_VALUES).includes(relationship)) {
    throw new Error(`--relationship must be one of: ${Object.values(Dependent.RELATIONSHIP_VALUES).join(', ')}`);
  }
  const head = await Member.findByPk(headId, { ...opt, lock: t.LOCK.UPDATE });
  if (!head) throw new Error(`Member ${headId} (--head) not found`);
  const member = await Member.findByPk(memberId, { ...opt, lock: t.LOCK.UPDATE });
  if (!member) throw new Error(`Member ${memberId} (--member) not found`);

  if (!isHead(head)) {
    const realHead = await Member.findByPk(head.family_id, opt);
    throw new Error(`${name(head)} is in the household of ${realHead ? name(realHead) : `#${head.family_id}`}; use that member as --head`);
  }

  // 1. Head: explicit self family_id.
  if (String(head.family_id) !== String(head.id)) {
    const was = head.family_id ?? 'empty';
    await head.update({ family_id: head.id }, opt);
    log.push(`${name(head)}: family_id ${was} -> ${head.id} (head of household)`);
  }

  // 2. Anyone in the member's own household moves to the head.
  const followers = await Member.findAll({
    where: { family_id: member.id, id: { [Op.ne]: member.id } }, ...opt
  });
  for (const f of followers) {
    await f.update({ family_id: head.id }, opt);
    log.push(`${name(f)}: was in ${name(member)}'s household -> ${name(head)}'s household`);
  }

  // 3. The member.
  if (String(member.family_id) !== String(head.id)) {
    const was = isHead(member) ? 'own household' : `household #${member.family_id}`;
    await member.update({ family_id: head.id }, opt);
    log.push(`${name(member)}: ${was} -> ${name(head)}'s household`);
  } else {
    log.push(`${name(member)}: already in ${name(head)}'s household`);
  }

  // 4. The member's dependents join the head's household. An ordinary
  // dependent's linkedMemberId holds its household's member (a dependent login
  // resolves its household from it), so one pointing at the member follows
  // them to the head too.
  const dependents = await Dependent.findAll({ where: { memberId: member.id }, ...opt });
  for (const d of dependents) {
    const changes = { memberId: head.id };
    if (String(d.linkedMemberId) === String(member.id)) changes.linkedMemberId = head.id;
    await d.update(changes, opt);
    log.push(`dependent ${d.firstName || ''} ${d.lastName || ''} (#${d.id}): -> ${name(head)}'s household`);
  }

  // 4b. List the member among the head's dependents, linked to their record.
  const norm = (v) => String(v || '').trim().toLowerCase();
  const existing = await Dependent.findAll({
    where: {
      [Op.or]: [
        { linkedMemberId: member.id },
        { memberId: head.id }
      ]
    },
    ...opt
  });
  // A row stands for the member when it links to them from someone else's
  // household. (linkedMemberId === memberId is an ordinary dependent.)
  const mine = existing.find((d) => String(d.linkedMemberId) === String(member.id) && String(d.memberId) !== String(member.id))
    || existing.find((d) => String(d.memberId) === String(head.id)
      && ((d.phone && d.phone === member.phone_number)
        || (norm(d.firstName) === norm(member.first_name) && norm(d.lastName) === norm(member.last_name))));
  if (mine) {
    const changes = {};
    if (String(mine.memberId) !== String(head.id)) changes.memberId = head.id;
    if (String(mine.linkedMemberId) !== String(member.id)) changes.linkedMemberId = member.id;
    if (Object.keys(changes).length > 0) {
      await mine.update(changes, opt);
      log.push(`dependent #${mine.id} (${mine.firstName} ${mine.lastName}): linked to ${name(member)} under ${name(head)}`);
    } else {
      log.push(`${name(member)}: already listed in ${name(head)}'s dependents (#${mine.id})`);
    }
  } else {
    const dep = await Dependent.create({
      memberId: head.id,
      linkedMemberId: member.id,
      firstName: member.first_name,
      middleName: member.middle_name || null,
      lastName: member.last_name,
      relationship,
      phone: member.phone_number || null,
      email: member.email || null,
      gender: member.gender || null,
      dateOfBirth: member.date_of_birth || null,
      baptismName: member.baptism_name || null
    }, opt);
    log.push(`${name(member)}: added to ${name(head)}'s dependents as ${relationship} (dependent #${dep.id}, linked to their member record)`);
  }

  // 5. Dues pledge: the head's covers the household.
  if (!keepPledge && Number(member.yearly_pledge || 0) !== 0) {
    log.push(`${name(member)}: yearly pledge ${money(member.yearly_pledge)} -> 0.00 (household dues use ${name(head)}'s ${money(head.yearly_pledge)})`);
    await member.update({ yearly_pledge: 0 }, opt);
  }

  // What the household looks like afterwards.
  const household = await Member.findAll({
    where: { [Op.or]: [{ id: head.id }, { family_id: head.id }] }, order: [['id', 'ASC']], ...opt
  });
  const duesCount = await Transaction.count({
    where: { member_id: household.map((m) => m.id), payment_type: 'membership_due', status: 'succeeded' }, ...opt
  });
  household.sort((a, b) => (String(a.id) === String(head.id) ? -1 : String(b.id) === String(head.id) ? 1 : 0));
  log.push(`household of ${name(head)}: ${household.map((m) => `${m.first_name} ${m.last_name}`).join(', ')}`
    + ` — dues pledge ${money(head.yearly_pledge)}/yr, ${duesCount} membership dues payment(s) counted`);
  if (Number(head.yearly_pledge || 0) === 0) {
    log.push(`WARNING: ${name(head)} has no yearly pledge, so the household owes no dues until one is set`);
  }

  return log;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const headId = arg('head');
  const memberId = arg('member');
  if (!headId || !memberId) {
    console.error('Usage: node scripts/link-household-member.js --head <memberId> --member <memberId> [--relationship Spouse] [--keep-pledge] [--apply]');
    process.exit(1);
  }

  const t = await sequelize.transaction();
  try {
    const log = await linkHouseholdMember({
      headId, memberId,
      keepPledge: process.argv.includes('--keep-pledge'),
      relationship: arg('relationship') || 'Spouse'
    }, t);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: member ${memberId} into the household of ${headId}\n`);
    log.forEach((line) => console.log(`  ${line}`));
    if (apply) {
      await t.commit();
      console.log('\nDone. All changes committed.');
    } else {
      await t.rollback();
      console.log('\nNothing changed (rolled back). Re-run with --apply to make these changes.');
    }
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Link failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { linkHouseholdMember };
