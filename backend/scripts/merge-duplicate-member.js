/**
 * Merges a duplicate member record into the correct one, then deletes the
 * duplicate — everywhere the duplicate was used gets moved onto the right
 * member first, not just re-pointed with a raw UPDATE:
 *
 *   - Pledge Drive pledges (pledges.member_id) -> the right member. A pledge
 *     that would collide with the right member's existing open pledge in the
 *     same campaign (the one-active-pledge-per-member-per-campaign rule)
 *     blocks the merge instead of failing on the DB constraint mid-transaction.
 *   - Every payment (transactions) the duplicate ever received, moved the
 *     rematch-payment-member.js way: transaction, ledger entry, bank row,
 *     Zelle email match, and pledge credit all follow. ALL of them, not only
 *     a given year — a payment left behind would go member_id = NULL the
 *     moment the duplicate is deleted (transactions.member_id is ON DELETE
 *     SET NULL), even one that funds a pledge that just moved to the right
 *     member.
 *   - Learned payer -> member keys (bank_memo_matches, zelle_memo_matches):
 *     always re-pointed, unlike rematch-payment-member.js's opt-in
 *     --remember-sender — a duplicate-member merge means the sender really
 *     is the same person, never a "paid on behalf of" case. Both tables are
 *     ON DELETE RESTRICT, so leaving any behind would block the delete.
 *
 * Refuses when the duplicate has dependents of their own (dependents.member_id
 * is ON DELETE CASCADE — deleting would silently delete them too; link them
 * with link-household-member.js first), is head of another member's household
 * (their family_id), or holds a member_loans row or a transactions.collected_by
 * row — a merge shouldn't silently move a loan liability or treasurer credit.
 *
 * One database transaction; dry run by default (performs and rolls back, so
 * its output is exactly what --apply will do), --apply to commit.
 *
 * From backend/:
 *   node scripts/merge-duplicate-member.js --from 363 --to 389 --by 3
 *   node scripts/merge-duplicate-member.js --from 363 --to 389 --by 3 --apply
 *
 *   --by   member id of the treasurer/admin making the correction (audit trail)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const models = require('../src/models');
const { rematchPayment } = require('./rematch-payment-member');

const {
  sequelize, Member, Dependent, Pledge, Transaction, MemberLoan, BankMemoMatch, ZelleMemoMatch
} = models;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = (m) => `${m.first_name} ${m.last_name} (#${m.id})`;

/** The merge itself, inside the caller's transaction `t`. Exported for tests. */
async function mergeDuplicateMember({ fromId, toId, byId }, t) {
  const log = [];
  const opt = { transaction: t };

  if (String(fromId) === String(toId)) throw new Error('--from and --to are the same member');
  const from = await Member.findByPk(fromId, { ...opt, lock: t.LOCK.UPDATE });
  if (!from) throw new Error(`Member ${fromId} (--from) not found`);
  const to = await Member.findByPk(toId, { ...opt, lock: t.LOCK.UPDATE });
  if (!to) throw new Error(`Member ${toId} (--to) not found`);
  const by = await Member.findByPk(byId, opt);
  if (!by) throw new Error(`Member ${byId} (--by) not found`);

  const dependents = await Dependent.count({ where: { memberId: from.id }, ...opt });
  if (dependents > 0) {
    throw new Error(`${name(from)} has ${dependents} dependent(s) of their own; deleting would cascade-delete them. Move them first with link-household-member.js.`);
  }
  const householdMembers = await Member.findAll({ where: { family_id: from.id }, ...opt });
  const otherHouseholdMembers = householdMembers.filter((m) => String(m.id) !== String(from.id));
  if (otherHouseholdMembers.length > 0) {
    throw new Error(`${name(from)} is head of another member's household (${otherHouseholdMembers.map((m) => name(m)).join(', ')}); resolve that first.`);
  }
  const loans = await MemberLoan.count({ where: { member_id: from.id }, ...opt });
  if (loans > 0) {
    throw new Error(`${name(from)} holds ${loans} member_loans row(s); a merge shouldn't silently move a loan liability. Resolve manually first.`);
  }
  const collected = await Transaction.count({ where: { collected_by: from.id }, ...opt });
  if (collected > 0) {
    throw new Error(`${name(from)} is recorded as collected_by on ${collected} transaction(s); resolve manually first.`);
  }

  // 1. Pledges.
  const pledges = await Pledge.findAll({ where: { member_id: from.id }, ...opt });
  for (const p of pledges) {
    const isOpenLater = p.lifecycle === 'active' && !p.is_historical && p.fulfillment_intent === 'later';
    if (isOpenLater) {
      const conflict = await Pledge.findOne({
        where: {
          campaign_id: p.campaign_id, member_id: to.id, lifecycle: 'active',
          is_historical: false, fulfillment_intent: 'later'
        },
        ...opt
      });
      if (conflict) {
        throw new Error(`Pledge ${p.id} (campaign ${p.campaign_id}) can't move: ${name(to)} already has an open pledge (#${conflict.id}) in that campaign. Resolve manually.`);
      }
    }
    log.push(`pledge ${p.id} (campaign ${p.campaign_id}, $${p.amount}): member ${name(from)} -> ${name(to)}`);
    await p.update({ member_id: to.id }, opt);
  }

  // 2. Every payment the duplicate ever received, moved the way
  // rematch-payment-member.js moves one: transaction, ledger entry, bank row,
  // Zelle email match, and pledge credit. Pledges already moved above, so a
  // payment funding one of them is recognized as already on the right
  // member's pledge and isn't reversed/re-credited.
  const transactions = await Transaction.findAll({ where: { member_id: from.id }, ...opt });
  for (const tx of transactions) {
    log.push(`-- transaction ${tx.id} --`);
    const txLog = await rematchPayment({
      transactionId: tx.id, toMemberId: to.id, byMemberId: by.id, rememberSender: true
    }, t);
    txLog.forEach((line) => log.push(`  ${line}`));
  }

  // 3. Any learned sender keys not already moved above (rematchPayment only
  // re-points keys derived from a transaction's own bank row).
  const bankKeys = await BankMemoMatch.findAll({ where: { member_id: from.id }, ...opt });
  for (const k of bankKeys) {
    log.push(`learned key "${k.match_key}": member #${from.id} -> #${to.id}`);
    await k.update({ member_id: to.id }, opt);
  }
  const zelleKeys = await ZelleMemoMatch.findAll({ where: { member_id: from.id }, ...opt });
  for (const k of zelleKeys) {
    log.push(`legacy memo "${k.memo}": member #${from.id} -> #${to.id}`);
    await k.update({ member_id: to.id, first_name: to.first_name, last_name: to.last_name }, opt);
  }

  // 4. The duplicate itself.
  await from.destroy(opt);
  log.push(`${name(from)} deleted`);

  return log;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const fromId = arg('from');
  const toId = arg('to');
  const byId = arg('by');
  if (!fromId || !toId || !byId) {
    console.error('Usage: node scripts/merge-duplicate-member.js --from <memberId> --to <memberId> --by <yourMemberId> [--apply]');
    process.exit(1);
  }

  const t = await sequelize.transaction();
  try {
    const log = await mergeDuplicateMember({ fromId, toId, byId }, t);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: merge member ${fromId} into ${toId}\n`);
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
      console.error('Merge failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { mergeDuplicateMember };
