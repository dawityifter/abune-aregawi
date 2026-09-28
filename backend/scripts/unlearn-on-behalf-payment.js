/**
 * Records that a payment was PAID ON BEHALF of the member it is credited to,
 * and removes what the matcher wrongly learned from it — without touching the
 * payment itself.
 *
 * Before sender learning was gated (see decideSenderLearning), crediting a
 * payment to a member re-pointed the sender's learned keys at that member.
 * One friend paying another member's pledge therefore taught the matcher that
 * every future payment from the friend belongs to the other member.
 *
 * Unchanged: the transaction, its ledger entry, its pledge credit, the bank
 * row's member and status. The payment stays credited where it is.
 *
 * Changed:
 *   - learned keys for this payment's sender (bank_memo_matches, and legacy
 *     zelle_memo_matches rows for the same payer) held by the credited member
 *     go back to --sender, or are deleted with --sender none (a sender who is
 *     not a member). Keys held by anyone else are left alone.
 *   - the bank row's reconciled_meta records the audit: sender_link
 *     THIS_PAYMENT_ONLY, who the sender is, who corrected it and when.
 *   - the Zelle email for this payment: marked THIS_PAYMENT_ONLY; an email
 *     still waiting on Zelle Review although the bank already recorded the
 *     payment is attached to it (BANK_POSTED), so it cannot be posted twice
 *     or re-matched.
 *
 * All changes run in ONE database transaction. A dry run performs them and
 * rolls back, so what it prints is exactly what --apply will do.
 *
 * From backend/:
 *   node scripts/unlearn-on-behalf-payment.js --transaction 4321 --sender 101 --by 3
 *   node scripts/unlearn-on-behalf-payment.js --transaction 4321 --sender 101 --by 3 --apply
 *
 *   --sender  member id of whoever actually sent the money, or "none"
 *   --by      member id of the treasurer making the correction (audit trail)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const models = require('../src/models');
const {
  getBankMatchKeys, normalizeDescriptionForKey, normalizeWords, sourceTypeFor
} = require('../src/services/bankMemoMatchService');
const { DAYS_AFTER, DAYS_BEFORE, samePayer } = require('../src/services/zelleBankCorrelationService');

const {
  sequelize, Transaction, BankTransaction, ZelleEmailQueue, Member, BankMemoMatch, ZelleMemoMatch
} = models;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = (m) => (m ? `${m.first_name} ${m.last_name} (#${m.id})` : 'nobody');
const ONE_TIME = ':THIS_PAYMENT_ONLY';

function shiftDay(value, days) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The Zelle email for this bank row that was never attached to the payment:
 * same transaction number, else the unique email with the same payer and
 * amount in the correlation window.
 */
async function findOrphanEmail(bankRow, opt) {
  const unposted = { transaction_id: null, bank_transaction_id: null, status: { [Op.ne]: 'IGNORED' } };
  if (bankRow.external_ref_id) {
    const exact = await ZelleEmailQueue.findOne({
      where: { ...unposted, external_id: `zelle:${String(bankRow.external_ref_id).trim().toUpperCase()}` }, ...opt
    });
    if (exact) return exact;
  }
  const fitting = (await ZelleEmailQueue.findAll({
    where: {
      ...unposted,
      amount: bankRow.amount,
      payment_date: { [Op.between]: [shiftDay(bankRow.date, -DAYS_AFTER), shiftDay(bankRow.date, DAYS_BEFORE)] }
    },
    ...opt
  })).filter((q) => samePayer(q.payer_name, bankRow.payer_name));
  return fitting.length === 1 ? fitting[0] : null;
}

/**
 * The correction itself, inside the caller's transaction `t`. Returns the
 * list of changes made. Exported for tests.
 */
async function unlearnOnBehalfPayment({ transactionId, senderMemberId, byMemberId }, t) {
  const log = [];
  const opt = { transaction: t };

  const tx = await Transaction.findByPk(transactionId, opt);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  if (!tx.member_id) throw new Error(`Transaction ${transactionId} is not credited to a member`);
  const credited = await Member.findByPk(tx.member_id, opt);
  const sender = senderMemberId === 'none' ? null : await Member.findByPk(senderMemberId, opt);
  if (senderMemberId !== 'none' && !sender) throw new Error(`Member ${senderMemberId} (--sender) not found`);
  if (sender && String(sender.id) === String(credited.id)) {
    throw new Error('--sender is the member the payment is credited to; that is not "on behalf of"');
  }
  const by = await Member.findByPk(byMemberId, opt);
  if (!by) throw new Error(`Member ${byMemberId} (--by) not found`);

  log.push(`transaction ${tx.id}: stays credited to ${name(credited)}, ${tx.amount} on ${tx.payment_date} (unchanged)`);

  const bankRow = tx.external_id
    ? await BankTransaction.findOne({ where: { transaction_hash: tx.external_id }, ...opt })
    : null;
  const emails = await ZelleEmailQueue.findAll({ where: { transaction_id: tx.id }, ...opt });
  const payerName = bankRow?.payer_name || emails.find((q) => q.payer_name)?.payer_name || null;
  if (!payerName) throw new Error(`No payer name on file for transaction ${tx.id}; nothing identifies the sender`);
  log.push(`sender on record: "${payerName}" = ${sender ? name(sender) : 'not a member'}`);

  // 1. Learned keys: the bank row's own keys plus the email-side keys
  //    (the email flow keys off "Zelle payment from <payer> 0000000").
  const keySources = [{ type: 'ZELLE', payer_name: payerName, description: `Zelle payment from ${payerName} 0000000` }];
  if (bankRow) keySources.push(bankRow.get({ plain: true }));
  const keys = [...new Set(keySources.flatMap((src) => getBankMatchKeys(src).map((k) => k.matchKey)))];

  // What the key pointed at before it was re-pointed: the sender's latest
  // own bank row, when there is one.
  const senderOwnRow = sender ? await BankTransaction.findOne({
    where: { payer_name: payerName, member_id: sender.id, status: 'MATCHED' },
    order: [['date', 'DESC'], ['id', 'DESC']],
    ...opt
  }) : null;

  const learned = await BankMemoMatch.findAll({ where: { match_key: keys }, ...opt });
  if (learned.length === 0) log.push('learned keys: none for this sender');
  for (const m of learned) {
    if (String(m.member_id) !== String(credited.id)) {
      log.push(`learned key "${m.match_key}": held by #${m.member_id}, left alone`);
      continue;
    }
    if (sender) {
      await m.update({ member_id: sender.id, created_from_bank_transaction_id: senderOwnRow?.id || null }, opt);
      log.push(`learned key "${m.match_key}": #${credited.id} -> ${name(sender)}`);
    } else {
      await m.destroy(opt);
      log.push(`learned key "${m.match_key}": deleted (sender is not a member)`);
    }
  }

  // 2. Legacy memo rows for this payer held by the credited member.
  const payerWords = normalizeWords(payerName);
  const legacyForms = new Set([payerWords]);
  if (bankRow) legacyForms.add(normalizeDescriptionForKey(bankRow.description, sourceTypeFor(bankRow)));
  const legacy = await ZelleMemoMatch.findAll({ where: { member_id: credited.id }, ...opt });
  for (const m of legacy) {
    const memo = normalizeWords(m.memo);
    if (![...legacyForms].some((form) => form && (memo === form || memo.startsWith(`${form} `)))) continue;
    if (sender) {
      await m.update({ member_id: sender.id, first_name: sender.first_name, last_name: sender.last_name }, opt);
      log.push(`legacy memo "${m.memo}": #${credited.id} -> ${name(sender)}`);
    } else {
      await m.destroy(opt);
      log.push(`legacy memo "${m.memo}": deleted`);
    }
  }

  // 3. Audit on the bank row. Merged, so an automatic reconciliation keeps
  //    the fields its undo needs.
  if (bankRow) {
    await bankRow.update({
      reconciled_meta: {
        ...(bankRow.reconciled_meta || {}),
        transaction_id: bankRow.reconciled_meta?.transaction_id || tx.id,
        member_id: bankRow.reconciled_meta?.member_id || credited.id,
        sender_link: 'THIS_PAYMENT_ONLY',
        sender_reason: 'UNLEARNED',
        sender_member_id: sender ? sender.id : null,
        sender_payer_name: payerName,
        unlearned_by: by.id,
        unlearned_at: new Date().toISOString()
      }
    }, opt);
    log.push(`bank row ${bankRow.id} (${bankRow.date}, ${payerName}): audit recorded — paid on behalf of ${name(credited)}`);
  } else {
    log.push('bank row: none linked yet (the audit is on the Zelle email)');
  }

  // 4. The Zelle email(s) for this payment.
  for (const q of emails) {
    if (!String(q.match_source || '').endsWith(ONE_TIME)) {
      const source = `${q.match_source || 'TREASURER_CREATE'}${ONE_TIME}`;
      await q.update({ match_source: source }, opt);
      log.push(`zelle email ${q.id}: match_source -> ${source}`);
    }
  }
  if (bankRow && emails.length === 0) {
    const orphan = await findOrphanEmail(bankRow, opt);
    if (orphan) {
      const wasStatus = orphan.status;
      await orphan.update({
        transaction_id: tx.id,
        bank_transaction_id: bankRow.id,
        matched_member_id: credited.id,
        match_confidence: 'high',
        match_source: `TREASURER_ATTACH${ONE_TIME}`,
        status: 'BANK_POSTED',
        matched_by: by.id,
        matched_at: new Date(),
        processed_at: new Date(),
        error: null
      }, opt);
      log.push(`zelle email ${orphan.id} (${orphan.external_id}): was still ${wasStatus} on Zelle Review; attached to transaction ${tx.id} as BANK_POSTED`);
    } else {
      log.push('zelle email: none waiting for this payment');
    }
  }

  return log;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const transactionId = arg('transaction');
  const senderMemberId = arg('sender');
  const byMemberId = arg('by');
  if (!transactionId || !senderMemberId || !byMemberId) {
    console.error('Usage: node scripts/unlearn-on-behalf-payment.js --transaction <id> --sender <memberId|none> --by <yourMemberId> [--apply]');
    process.exit(1);
  }

  const t = await sequelize.transaction();
  try {
    const log = await unlearnOnBehalfPayment({ transactionId, senderMemberId, byMemberId }, t);
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
      console.error('Unlearn failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { unlearnOnBehalfPayment };
