/**
 * Resolves Zelle payments recorded twice: once from the Zelle email (mostly
 * rows the Gmail sync auto-created in Jul–Aug 2026, stored without a payer
 * name) and again when bank reconciliation approved the matching bank row.
 * Bank reconciliation could not see the email entry without a payer name, so
 * it created a second one.
 *
 * Keeps the bank-confirmed transaction — it is already reconciled to its bank
 * row and carries the member/type the treasurer approved there — and:
 *   - deletes the email-created transaction and its ledger entries (same
 *     rules as delete-duplicate-transaction.js: refused if pledge-allocated)
 *   - carries its receipt number over when the bank entry has none
 *   - points the email at the kept transaction: BANK_POSTED, its bank row,
 *     and the bank's payer name if the email had none
 * The bank row itself is not changed.
 *
 * A pair is: an email whose transaction the bank never confirmed, and a
 * MATCHED Zelle bank row of the same amount, posted 1 day before .. 5 days
 * after the email, reconciled to a different transaction. Refused when the
 * two transactions credit different members — decide those by hand.
 *
 * From backend/:
 *   node scripts/resolve-zelle-bank-duplicates.js                       # report only, changes nothing
 *   node scripts/resolve-zelle-bank-duplicates.js --bank 1234           # dry run one pair
 *   node scripts/resolve-zelle-bank-duplicates.js --bank 1234 --apply
 *   node scripts/resolve-zelle-bank-duplicates.js --bank 1234 --email 56 --apply   # when two emails fit
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const {
  sequelize, Transaction, ZelleEmailQueue, BankTransaction
} = require('../src/models');
const { isBankHash, DAYS_BEFORE, DAYS_AFTER } = require('../src/services/zelleBankCorrelationService');
const { sourceTypeFor } = require('../src/services/bankMemoMatchService');
const { deleteDuplicateTransaction } = require('./delete-duplicate-transaction');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function addDays(dateOnly, days) {
  const d = new Date(`${String(dateOnly).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
}

/** Emails whose transaction exists but was never confirmed by the bank. */
async function unconfirmedEmails(where, opt) {
  const rows = await ZelleEmailQueue.findAll({
    where: { ...where, transaction_id: { [Op.ne]: null }, bank_transaction_id: null, status: { [Op.ne]: 'IGNORED' } },
    include: [{ model: Transaction, as: 'transaction', required: true }],
    order: [['payment_date', 'ASC'], ['id', 'ASC']],
    ...opt
  });
  return rows.filter((q) => !isBankHash(q.transaction.external_id) && q.transaction.status !== 'failed');
}

/** The transaction this bank row is reconciled to, and the emails it could be. */
async function describeBankRow(bankRow, opt = {}) {
  const bankTx = await Transaction.findOne({ where: { external_id: bankRow.transaction_hash }, ...opt });
  if (!bankTx) return null;
  const bankDate = dateOnly(bankRow.date);
  const emails = await unconfirmedEmails({
    amount: bankRow.amount,
    payment_date: { [Op.between]: [addDays(bankDate, -DAYS_AFTER), addDays(bankDate, DAYS_BEFORE)] }
  }, opt);
  return { bankTx, emails: emails.filter((q) => String(q.transaction.id) !== String(bankTx.id)) };
}

const sameMember = (q, bankTx) => String(q.transaction.member_id) === String(bankTx.member_id);

// Same-amount dues from different people often land in the same week. When an
// email credits the bank entry's member, that is the pair; the others are
// someone else's payment.
function narrowToMember(emails, bankTx) {
  const mine = emails.filter((q) => sameMember(q, bankTx));
  return mine.length > 0 ? mine : emails;
}

function problemsFor(emailTx, bankTx) {
  return String(emailTx.member_id) === String(bankTx.member_id)
    ? []
    : [`credit different members (email entry: member ${emailTx.member_id}, bank entry: member ${bankTx.member_id})`];
}

/** Read-only: every email/bank duplicate pair. Exported for tests. */
async function findDuplicatePairs() {
  const bankRows = await BankTransaction.findAll({
    where: { status: 'MATCHED', amount: { [Op.gt]: 0 } },
    order: [['date', 'ASC'], ['id', 'ASC']]
  });
  const claimed = new Set((await ZelleEmailQueue.findAll({
    where: { bank_transaction_id: { [Op.ne]: null } }, attributes: ['bank_transaction_id']
  })).map((q) => String(q.bank_transaction_id)));

  const pairs = [];
  for (const bankRow of bankRows) {
    if (sourceTypeFor(bankRow) !== 'ZELLE' || claimed.has(String(bankRow.id))) continue;
    const found = await describeBankRow(bankRow);
    if (!found) continue;
    const emails = narrowToMember(found.emails, found.bankTx);
    for (const queueRow of emails) {
      pairs.push({
        queueRow,
        emailTx: queueRow.transaction,
        bankRow,
        bankTx: found.bankTx,
        ambiguous: emails.length > 1,
        problems: problemsFor(queueRow.transaction, found.bankTx)
      });
    }
  }
  // A different-member pairing is only worth showing for an email that found
  // no bank row of its own member.
  const paired = new Set(pairs.filter((p) => p.problems.length === 0).map((p) => String(p.queueRow.id)));
  return pairs.filter((p) => p.problems.length === 0 || !paired.has(String(p.queueRow.id)));
}

/** Resolves one pair inside the caller's transaction `t`. Exported for tests. */
async function resolveDuplicatePair({ bankTransactionId, queueId = null }, t) {
  const opt = { transaction: t };
  const log = [];

  const bankRow = await BankTransaction.findByPk(bankTransactionId, opt);
  if (!bankRow) throw new Error(`Bank row ${bankTransactionId} not found`);
  if (bankRow.status !== 'MATCHED') throw new Error(`Bank row ${bankRow.id} is ${bankRow.status}, not MATCHED`);
  if (sourceTypeFor(bankRow) !== 'ZELLE') throw new Error(`Bank row ${bankRow.id} is not a Zelle credit`);
  const owner = await ZelleEmailQueue.findOne({ where: { bank_transaction_id: bankRow.id }, ...opt });
  if (owner) throw new Error(`Bank row ${bankRow.id} is already paired with email ${owner.id}`);

  const found = await describeBankRow(bankRow, opt);
  if (!found) throw new Error(`Bank row ${bankRow.id} has no transaction reconciled to it`);
  let emails = queueId
    ? found.emails.filter((q) => String(q.id) === String(queueId))
    : narrowToMember(found.emails, found.bankTx);
  if (emails.length === 0) {
    throw new Error(`No unconfirmed email-created payment fits bank row ${bankRow.id}${queueId ? ` as email ${queueId}` : ''}`);
  }
  if (emails.length > 1) {
    throw new Error(`Emails ${emails.map((q) => q.id).join(', ')} all fit bank row ${bankRow.id}; name one with --email <id>`);
  }

  const queueRow = emails[0];
  const emailTx = queueRow.transaction;
  const { bankTx } = found;
  const problems = problemsFor(emailTx, bankTx);
  if (problems.length > 0) throw new Error(`Transactions ${emailTx.id} and ${bankTx.id} ${problems[0]}`);

  const receipt = emailTx.receipt_number;
  log.push(`keep transaction ${bankTx.id} (bank row ${bankRow.id}, $${bankTx.amount}, ${bankTx.payment_type}, ${dateOnly(bankTx.payment_date)})`);
  log.push(...await deleteDuplicateTransaction({
    transactionId: emailTx.id,
    reason: `duplicate of #${bankTx.id} (Zelle email ${queueRow.id}, bank row ${bankRow.id})`
  }, t));

  if (receipt && !bankTx.receipt_number) {
    await bankTx.update({ receipt_number: receipt }, opt);
    log.push(`moved receipt ${receipt} to transaction ${bankTx.id}`);
  }

  const hadPayerName = !!queueRow.payer_name;
  const payerName = queueRow.payer_name || bankRow.payer_name || null;
  await queueRow.update({
    transaction_id: bankTx.id,
    bank_transaction_id: bankRow.id,
    matched_member_id: bankTx.member_id || queueRow.matched_member_id,
    status: 'BANK_POSTED',
    payer_name: payerName,
    processed_at: new Date()
  }, opt);
  log.push(`email ${queueRow.id} -> transaction ${bankTx.id}, bank row ${bankRow.id}, BANK_POSTED`
    + (!hadPayerName && payerName ? `, payer name "${payerName}"` : ''));

  return log;
}

async function report() {
  const pairs = await findDuplicatePairs();
  if (pairs.length === 0) {
    console.log('No email/bank duplicate pairs found.');
    return;
  }
  console.log(`${pairs.length} email/bank duplicate pair(s). Read-only; nothing changed.\n`);
  for (const p of pairs) {
    console.log(`bank row ${p.bankRow.id} (${dateOnly(p.bankRow.date)}, $${p.bankRow.amount}, "${p.bankRow.payer_name || ''}") -> keeps transaction ${p.bankTx.id} (member ${p.bankTx.member_id}, ${p.bankTx.payment_type})`);
    console.log(`  email ${p.queueRow.id} (${p.queueRow.payment_date}, ${p.queueRow.status}, payer ${p.queueRow.payer_name ? `"${p.queueRow.payer_name}"` : 'none'}) -> deletes transaction ${p.emailTx.id} (member ${p.emailTx.member_id}, ${p.emailTx.payment_type})`);
    if (p.problems.length) {
      console.log(`  SKIP: ${p.problems.join('; ')}`);
      console.log('  Likely not a duplicate: this email\'s own bank row may still be PENDING — link it from Bank Reconciliation.');
    }
    else console.log(`  node scripts/resolve-zelle-bank-duplicates.js --bank ${p.bankRow.id}${p.ambiguous ? ` --email ${p.queueRow.id}` : ''}`);
    if (p.ambiguous) console.log('  NOTE: more than one email fits this bank row — check which one it is.');
    console.log('');
  }
}

async function main() {
  const bankTransactionId = arg('bank');
  if (!bankTransactionId) return report();

  const apply = process.argv.includes('--apply');
  const t = await sequelize.transaction();
  try {
    const log = await resolveDuplicatePair({ bankTransactionId, queueId: arg('email') || null }, t);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: resolve duplicate for bank row ${bankTransactionId}\n`);
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
      console.error('Resolve failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { findDuplicatePairs, resolveDuplicatePair };
