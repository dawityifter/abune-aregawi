/**
 * Moves a payment that was matched to the wrong member onto the right one,
 * everywhere the match was recorded — not just the transaction row:
 *
 *   - transactions.member_id
 *   - its ledger entry's member_id (bank link, GL code and dates untouched)
 *   - the bank row's member_id, when the payment came from bank reconciliation
 *   - the Zelle email row's matched member, when there is one
 *   - Pledge Drive credit: the wrong member's pledge allocation is REVERSED
 *     (an appended reversal row with a reason — allocations are append-only)
 *     and the payment is credited to the right member's open pledge in the
 *     same drive. With no open pledge it is left unallocated, where it shows
 *     in the Unallocated queue for the treasurer.
 *   - ONLY with --remember-sender: the learned payer -> member keys this
 *     payment's bank row teaches (bank_memo_matches, zelle_memo_matches), so
 *     the next payment from the same payer is suggested for the right member.
 *     Off by default: a payment credited to someone other than the sender
 *     ("paid on behalf of") says nothing about who the sender is. Use it when
 *     the sender really is the right member (the old match was a mistake
 *     about identity). --keep-learned is accepted and is now the default.
 *
 * Why not the Edit Transaction screen: it changes transactions.member_id only,
 * rebuilds the ledger entry without its bank reference, and leaves the pledge
 * credit and learned keys pointing at the wrong member.
 *
 * All changes run in ONE database transaction. A dry run performs them and
 * rolls back, so what it prints is exactly what --apply will do.
 *
 * From backend/:
 *   node scripts/rematch-payment-member.js --transaction 1668 --to 267 --by 3
 *   node scripts/rematch-payment-member.js --transaction 1668 --to 267 --by 3 --apply
 *   node scripts/rematch-payment-member.js --transaction 1668 --to 267 --by 3 --remember-sender --apply
 *
 *   --by   member id of the treasurer making the correction (audit trail)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const models = require('../src/models');
const { reverse, allocate } = require('../src/services/pledgeAllocationService');
const { getBankMatchKeys, sourceTypeFor, normalizeDescriptionForKey } = require('../src/services/bankMemoMatchService');

const {
  sequelize, Transaction, LedgerEntry, BankTransaction, ZelleEmailQueue, Member,
  Pledge, PledgeAllocation, BankMemoMatch, ZelleMemoMatch
} = models;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = (m) => (m ? `${m.first_name} ${m.last_name} (#${m.id})` : 'nobody');

/**
 * The correction itself, inside the caller's transaction `t`. Returns the
 * list of changes made. Exported for tests.
 */
async function rematchPayment({ transactionId, toMemberId, byMemberId, rememberSender = false }, t) {
  const log = [];
  const opt = { transaction: t };

  const tx = await Transaction.findByPk(transactionId, { ...opt, lock: t.LOCK.UPDATE });
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  const to = await Member.findByPk(toMemberId, opt);
  if (!to) throw new Error(`Member ${toMemberId} not found`);
  const by = await Member.findByPk(byMemberId, opt);
  if (!by) throw new Error(`Member ${byMemberId} (--by) not found`);

  const reason = `Payment matched to the wrong member; moved to ${to.first_name} ${to.last_name} (#${to.id}) by ${by.first_name} ${by.last_name} (#${by.id})`;

  // 1. Transaction
  if (String(tx.member_id) !== String(to.id)) {
    const from = tx.member_id ? await Member.findByPk(tx.member_id, opt) : null;
    await tx.update({ member_id: to.id }, opt);
    log.push(`transaction ${tx.id}: member ${name(from)} -> ${name(to)}`);
  } else {
    log.push(`transaction ${tx.id}: already ${name(to)}`);
  }

  // 2. Ledger entry
  const ledgers = await LedgerEntry.findAll({ where: { transaction_id: tx.id }, ...opt });
  for (const le of ledgers) {
    if (String(le.member_id) !== String(to.id)) {
      log.push(`ledger entry ${le.id}: member #${le.member_id} -> #${to.id}`);
      await le.update({ member_id: to.id }, opt);
    }
  }

  // 3. Bank row (linked by the transaction's external_id = bank hash)
  const bankRow = tx.external_id
    ? await BankTransaction.findOne({ where: { transaction_hash: tx.external_id }, ...opt })
    : null;
  const wrongMemberIds = new Set();
  if (bankRow) {
    if (bankRow.member_id && String(bankRow.member_id) !== String(to.id)) wrongMemberIds.add(String(bankRow.member_id));
    if (String(bankRow.member_id) !== String(to.id)) {
      log.push(`bank row ${bankRow.id} (${bankRow.date}, ${bankRow.payer_name}): member #${bankRow.member_id} -> #${to.id}`);
      await bankRow.update({ member_id: to.id }, opt);
    }
  }
  for (const le of ledgers) {
    if (le.member_id && String(le.member_id) !== String(to.id)) wrongMemberIds.add(String(le.member_id));
  }

  // 4. Zelle email row
  const emails = await ZelleEmailQueue.findAll({ where: { transaction_id: tx.id }, ...opt });
  for (const q of emails) {
    if (String(q.matched_member_id) !== String(to.id)) {
      if (q.matched_member_id) wrongMemberIds.add(String(q.matched_member_id));
      log.push(`zelle email ${q.id}: matched member #${q.matched_member_id} -> #${to.id}`);
      await q.update({
        matched_member_id: to.id, match_source: 'TREASURER_REMATCH', match_confidence: 'high',
        matched_by: by.id, matched_at: new Date()
      }, opt);
    }
  }

  // 5. Pledge credit. Net each original allocation against its reversals.
  const allocations = await PledgeAllocation.findAll({
    where: { transaction_id: tx.id }, order: [['id', 'ASC']], ...opt
  });
  const originals = allocations.filter((a) => !a.reverses_allocation_id && parseFloat(a.amount) > 0);
  const campaignsToCredit = new Set();
  let movedAmount = 0;
  for (const a of originals) {
    const reversed = allocations
      .filter((r) => String(r.reverses_allocation_id) === String(a.id))
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const outstanding = parseFloat(a.amount) + reversed;
    if (outstanding <= 1e-9) continue;

    const pledge = await Pledge.findByPk(a.pledge_id, opt);
    if (pledge && String(pledge.member_id) === String(to.id)) {
      log.push(`pledge allocation ${a.id}: already on ${name(to)}'s pledge #${pledge.id}`);
      continue;
    }
    if (pledge?.member_id) wrongMemberIds.add(String(pledge.member_id));
    await reverse({ allocationId: a.id, reason, reversedBy: by.id }, opt);
    log.push(`pledge allocation ${a.id}: reversed ${outstanding.toFixed(2)} off pledge #${a.pledge_id} (member #${pledge?.member_id})`);
    if (pledge) campaignsToCredit.add(String(pledge.campaign_id));
    movedAmount += outstanding;
  }

  if (movedAmount > 0) {
    for (const campaignId of campaignsToCredit) {
      const target = await Pledge.findOne({
        where: {
          campaign_id: campaignId, member_id: to.id, lifecycle: 'active',
          is_historical: false, fulfillment_intent: 'later'
        },
        ...opt
      });
      if (!target) {
        log.push(`no open pledge for ${name(to)} in campaign ${campaignId}: payment left UNALLOCATED (see the Unallocated queue)`);
        continue;
      }
      const alloc = await allocate({
        pledgeId: target.id,
        transactionId: tx.id,
        amount: movedAmount,
        source: 'treasurer_manual',
        allocatedBy: by.id,
        idempotencyKey: `rematch:txn:${tx.id}:pledge:${target.id}`
      }, opt);
      log.push(`pledge allocation ${alloc.id}: credited ${movedAmount.toFixed(2)} to ${name(to)}'s pledge #${target.id}`);
    }
  }

  // Where each affected pledge ends up, counting ALL of its credits — a pledge
  // may also hold the member's own payments, so "reversed" does not mean
  // "now owed".
  const affectedPledgeIds = [...new Set(
    (await PledgeAllocation.findAll({ where: { transaction_id: tx.id }, attributes: ['pledge_id'], ...opt }))
      .map((a) => String(a.pledge_id))
  )];
  // Payments whose credits on the pledge still net above zero.
  const contributing = (credited) => {
    const net = new Map();
    credited.forEach((a) => net.set(String(a.transaction_id), (net.get(String(a.transaction_id)) || 0) + parseFloat(a.amount)));
    return [...net.values()].filter((v) => v > 1e-9).length;
  };
  for (const pledgeId of affectedPledgeIds) {
    const pledge = await Pledge.findByPk(pledgeId, opt);
    const credited = await PledgeAllocation.findAll({ where: { pledge_id: pledgeId }, ...opt });
    const paid = credited.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const owner = await Member.findByPk(pledge.member_id, opt);
    const pledged = parseFloat(pledge.amount);
    log.push(`pledge #${pledgeId} (${name(owner)}): pledged ${pledged.toFixed(2)}, paid ${paid.toFixed(2)}, `
      + `${paid >= pledged ? 'paid in full' : `${(pledged - paid).toFixed(2)} still owed`}`
      + ` — from ${contributing(credited)} payment(s)`);
  }

  // 6. Learned payer -> member keys taught by this payment's bank row — only
  // when the treasurer says the sender IS the right member.
  if (!rememberSender && bankRow) {
    log.push('learned sender keys left alone (pass --remember-sender to re-point them)');
  }
  if (rememberSender && bankRow) {
    const plain = bankRow.get({ plain: true });
    const keys = getBankMatchKeys(plain).map((k) => k.matchKey);
    if (keys.length > 0) {
      const learned = await BankMemoMatch.findAll({ where: { match_key: keys }, ...opt });
      for (const m of learned) {
        if (String(m.member_id) !== String(to.id)) {
          log.push(`learned key "${m.match_key}": member #${m.member_id} -> #${to.id}`);
          await m.update({ member_id: to.id }, opt);
        }
      }
    }
    // Legacy memo table: rows for this payer held by a wrongly matched member.
    const payerWords = normalizeDescriptionForKey(plain.description, sourceTypeFor(plain));
    if (payerWords && wrongMemberIds.size > 0) {
      const legacy = await ZelleMemoMatch.findAll({
        where: { member_id: [...wrongMemberIds] }, ...opt
      });
      const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
      for (const m of legacy) {
        const memo = norm(m.memo);
        if (memo === payerWords || memo.startsWith(`${payerWords} `)) {
          log.push(`legacy memo "${m.memo}": member #${m.member_id} -> #${to.id}`);
          await m.update({ member_id: to.id, first_name: to.first_name, last_name: to.last_name }, opt);
        }
      }
    }
  }

  return log;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const transactionId = arg('transaction');
  const toMemberId = arg('to');
  const byMemberId = arg('by');
  if (!transactionId || !toMemberId || !byMemberId) {
    console.error('Usage: node scripts/rematch-payment-member.js --transaction <id> --to <memberId> --by <yourMemberId> [--remember-sender] [--apply]');
    process.exit(1);
  }

  const t = await sequelize.transaction();
  try {
    const log = await rematchPayment({
      transactionId, toMemberId, byMemberId, rememberSender: process.argv.includes('--remember-sender')
    }, t);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: transaction ${transactionId}\n`);
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
      console.error('Rematch failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { rematchPayment };
