/**
 * Resolves bank deposits recorded as more than one transaction. Before
 * September 2026 the same Zelle deposit could be recorded three ways that did
 * not see each other: the original Gmail automation (gmail:<id> entries with
 * no Zelle Review row), Add Payment with a receipt, and bank reconciliation —
 * notably the automatic pass of 2026-07-14 over the old CSV backlog, which
 * created a transaction per deposit (AUTO_MEMBER) beside the existing entry.
 *
 * A group is one MATCHED bank credit, the transaction reconciled to it, and
 * every other entry for the same member and amount dated 5 days before .. 1
 * day after the deposit that no bank deposit confirms. Exactly one entry
 * survives:
 *   - the one carrying a real (numeric) receipt number the member was given,
 *   - else the first one recorded (its type came from the email memo or a
 *     treasurer; the automatic pass only guessed the member's default).
 * The deposit is moved onto it (external_id = bank hash, as Link does) and
 * the others are deleted with their ledger entries. Zelle Review emails of
 * deleted entries point at the survivor. A deposit the automatic pass created
 * becomes AUTO_LINKED with created:false, so a later undo unlinks the
 * survivor rather than deleting it.
 *
 * Listed but not resolved:
 *   - entries disagree on payment type: name the right one with --type;
 *   - two entries carry real receipts;
 *   - the same sender has another deposit of that amount nearby (the "extra"
 *     entry may be that payment);
 *   - an entry to delete is allocated to a pledge.
 *
 * From backend/:
 *   node scripts/resolve-bank-deposit-duplicates.js                          # report only
 *   node scripts/resolve-bank-deposit-duplicates.js --bank 1087              # dry run one deposit
 *   node scripts/resolve-bank-deposit-duplicates.js --bank 1087 --apply
 *   node scripts/resolve-bank-deposit-duplicates.js --bank 988 --type tithe --apply
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const {
  sequelize, Transaction, LedgerEntry, ZelleEmailQueue, BankTransaction, PledgeAllocation
} = require('../src/models');
const { isBankHash, samePayer, DAYS_BEFORE, DAYS_AFTER } = require('../src/services/zelleBankCorrelationService');
const { resolveIncomeCategory } = require('../src/services/zelleTransactionService');
const { deleteDuplicateTransaction } = require('./delete-duplicate-transaction');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
}

function addDays(day, days) {
  const d = new Date(`${dateOnly(day)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const realReceipt = (tx) => /^\d+$/.test(String(tx.receipt_number || '')) && !/^0+$/.test(tx.receipt_number);
const byRecorded = (a, b) => (new Date(a.created_at) - new Date(b.created_at)) || (a.id - b.id);

/** The duplicate group for one MATCHED bank credit, or null. */
async function groupForBankRow(bankRow, opt = {}) {
  if (bankRow.status !== 'MATCHED' || !(Number(bankRow.amount) > 0)) return null;
  const bankTx = await Transaction.findOne({ where: { external_id: bankRow.transaction_hash }, ...opt });
  if (!bankTx || !bankTx.member_id || bankTx.status === 'failed') return null;

  const bankDay = dateOnly(bankRow.date);
  const extras = (await Transaction.findAll({
    where: {
      id: { [Op.ne]: bankTx.id },
      member_id: bankTx.member_id,
      amount: bankTx.amount,
      status: { [Op.ne]: 'failed' },
      payment_date: { [Op.between]: [addDays(bankDay, -DAYS_AFTER), addDays(bankDay, DAYS_BEFORE)] }
    },
    ...opt
  })).filter((t) => !isBankHash(t.external_id));
  if (extras.length === 0) return null;

  const entries = [bankTx, ...extras].sort(byRecorded);
  const receipts = entries.filter(realReceipt);
  const keep = receipts[0] || entries[0];
  const remove = entries.filter((t) => t.id !== keep.id);

  const problems = [];
  if (new Set(receipts.map((t) => t.receipt_number)).size > 1) {
    problems.push(`two receipts were issued (${receipts.map((t) => `#${t.id}: ${t.receipt_number}`).join(', ')})`);
  }
  if (bankRow.payer_name) {
    const nearby = await BankTransaction.findAll({
      where: {
        id: { [Op.ne]: bankRow.id },
        amount: bankRow.amount,
        status: { [Op.ne]: 'IGNORED' },
        date: { [Op.between]: [addDays(bankDay, -(DAYS_AFTER + DAYS_BEFORE)), addDays(bankDay, DAYS_AFTER + DAYS_BEFORE)] }
      },
      ...opt
    });
    const sameSender = nearby.filter((b) => samePayer(b.payer_name, bankRow.payer_name));
    if (sameSender.length > 0) {
      problems.push(`the same sender has another deposit of this amount (bank row ${sameSender.map((b) => `${b.id} ${dateOnly(b.date)} ${b.status}`).join(', ')}); an extra entry may be that payment`);
    }
  }
  const allocated = await PledgeAllocation.findAll({ where: { transaction_id: remove.map((t) => t.id) }, attributes: ['transaction_id'], ...opt });
  if (allocated.length > 0) {
    problems.push(`entry ${[...new Set(allocated.map((a) => a.transaction_id))].join(', ')} is allocated to a pledge`);
  }

  const types = [...new Set(entries.map((t) => t.payment_type))];
  const typeClash = types.length > 1;
  if (typeClash) problems.push(`types differ (${entries.map((t) => `#${t.id} ${t.payment_type}`).join(', ')}); choose with --type`);

  return { bankRow, bankTx, keep, remove, entries, problems, typeClash };
}

/** Read-only: every deposit recorded more than once. Exported for tests. */
async function findDepositDuplicates() {
  const bankRows = await BankTransaction.findAll({
    where: { status: 'MATCHED', amount: { [Op.gt]: 0 } },
    order: [['date', 'ASC'], ['id', 'ASC']]
  });
  const groups = [];
  for (const bankRow of bankRows) {
    const group = await groupForBankRow(bankRow);
    if (group) groups.push(group);
  }
  return groups;
}

/** Resolves one deposit inside the caller's transaction `t`. Exported for tests. */
async function resolveDepositDuplicates({ bankTransactionId, paymentType = null }, t) {
  const opt = { transaction: t };
  const log = [];

  const bankRow = await BankTransaction.findByPk(bankTransactionId, opt);
  if (!bankRow) throw new Error(`Bank row ${bankTransactionId} not found`);
  const group = await groupForBankRow(bankRow, opt);
  if (!group) throw new Error(`Bank row ${bankRow.id} has no duplicate entries`);

  const hard = group.problems.filter((p) => !p.startsWith('types differ'));
  if (hard.length > 0) throw new Error(`Bank row ${bankRow.id}: ${hard.join('; ')}`);
  if (group.typeClash && !paymentType) {
    throw new Error(`Bank row ${bankRow.id}: ${group.problems.find((p) => p.startsWith('types differ'))}`);
  }

  if (paymentType && !Transaction.rawAttributes.payment_type.values.includes(paymentType)) {
    throw new Error(`"${paymentType}" is not a payment type (${Transaction.rawAttributes.payment_type.values.join(', ')})`);
  }
  // Only a change of type touches the GL code, resolved as the app does.
  let category = null;
  const retype = paymentType && paymentType !== group.keep.payment_type;
  if (retype) {
    category = (await resolveIncomeCategory(paymentType)) || { id: null, gl_code: 'INC999' };
  }

  const { keep, remove, bankTx } = group;
  const removedIds = remove.map((tx) => tx.id);
  log.push(`keep transaction ${keep.id} ($${keep.amount}, ${keep.payment_type}, ${dateOnly(keep.payment_date)}`
    + `${keep.receipt_number ? `, receipt ${keep.receipt_number}` : ''}, ${keep.external_id || 'no external id'})`);

  // Read before deleting: the queue's foreign key nulls transaction_id on delete.
  const emails = await ZelleEmailQueue.findAll({ where: { transaction_id: [keep.id, ...removedIds] }, ...opt });

  for (const tx of remove) {
    log.push(...await deleteDuplicateTransaction({
      transactionId: tx.id, reason: `duplicate of #${keep.id} (bank row ${bankRow.id})`
    }, t));
  }

  if (keep.id !== bankTx.id) {
    const prevExternalId = keep.external_id || null;
    await keep.update({ external_id: bankRow.transaction_hash }, opt);
    const automatic = String(bankRow.reconciled_source || '').startsWith('AUTO_');
    await bankRow.update({
      reconciled_source: automatic ? 'AUTO_LINKED' : bankRow.reconciled_source,
      reconciled_meta: {
        ...(bankRow.reconciled_meta || {}),
        transaction_id: keep.id,
        created: false,
        prev_external_id: prevExternalId,
        merged_duplicates: removedIds,
        reason: `Duplicate entries merged into the earlier entry #${keep.id}`
      }
    }, opt);
    log.push(`bank row ${bankRow.id} -> transaction ${keep.id}${automatic ? ' (now AUTO_LINKED; undo unlinks it)' : ''}`);
  }

  const ledgerFields = { external_id: bankRow.transaction_hash, statement_date: dateOnly(bankRow.date) };
  if (category) {
    await keep.update({ payment_type: paymentType, income_category_id: category.id }, opt);
    Object.assign(ledgerFields, { type: paymentType, category: category.gl_code });
    log.push(`transaction ${keep.id} type -> ${paymentType}`);
  }
  const [updated] = await LedgerEntry.update(ledgerFields, { where: { transaction_id: keep.id }, ...opt });
  if (updated === 0) {
    // Some Gmail-era entries never got one; the deleted duplicate's was the
    // only ledger record of this income. Same shape bank reconciliation writes.
    const type = keep.payment_type;
    const glCode = category?.gl_code
      || (await resolveIncomeCategory(type))?.gl_code
      || 'INC999';
    await LedgerEntry.create({
      type,
      category: glCode,
      amount: parseFloat(keep.amount),
      entry_date: keep.payment_date,
      member_id: keep.member_id,
      payment_method: keep.payment_method,
      receipt_number: keep.receipt_number || null,
      memo: `${glCode} - Bank reconciliation match ${bankRow.transaction_hash}`,
      transaction_id: keep.id,
      collected_by: keep.collected_by || null,
      ...ledgerFields
    }, opt);
    log.push(`created ledger entry for transaction ${keep.id} (it had none)`);
  }

  const claimed = await ZelleEmailQueue.findOne({ where: { bank_transaction_id: bankRow.id }, ...opt });
  let bankClaimed = !!claimed;
  for (const q of emails) {
    const fields = { transaction_id: keep.id };
    if (!q.bank_transaction_id && !bankClaimed) {
      Object.assign(fields, { bank_transaction_id: bankRow.id, status: 'BANK_POSTED', payer_name: q.payer_name || bankRow.payer_name || null });
      bankClaimed = true;
    }
    await q.update(fields, opt);
    log.push(`email ${q.id} -> transaction ${keep.id}${fields.bank_transaction_id ? `, bank row ${bankRow.id}` : ''}`);
  }

  return log;
}

function describe(tx) {
  return `#${tx.id} ${tx.payment_type} ${dateOnly(tx.payment_date)}${tx.receipt_number ? ` receipt ${tx.receipt_number}` : ''} [${String(tx.external_id || 'manual').slice(0, 14)}]`;
}

async function report() {
  const groups = await findDepositDuplicates();
  if (groups.length === 0) {
    console.log('No deposits recorded more than once.');
    return;
  }
  const ready = groups.filter((g) => g.problems.length === 0);
  const typed = groups.filter((g) => g.problems.length === 1 && g.typeClash);
  const review = groups.filter((g) => !ready.includes(g) && !typed.includes(g));
  const extra = groups.reduce((n, g) => n + g.remove.length, 0);
  console.log(`${groups.length} deposit(s) recorded more than once; ${extra} extra entr${extra === 1 ? 'y' : 'ies'}. Read-only; nothing changed.`);
  console.log(`  ready: ${ready.length}   need --type: ${typed.length}   need review: ${review.length}\n`);

  const print = (title, list, command) => {
    if (list.length === 0) return;
    console.log(`== ${title} ==\n`);
    for (const g of list) {
      console.log(`bank row ${g.bankRow.id} (${dateOnly(g.bankRow.date)}, $${g.bankRow.amount}, "${g.bankRow.payer_name || ''}", ${g.bankRow.reconciled_source || 'manual'}) member ${g.keep.member_id}`);
      console.log(`  keep    ${describe(g.keep)}`);
      g.remove.forEach((tx) => console.log(`  delete  ${describe(tx)}`));
      g.problems.forEach((p) => console.log(`  ! ${p}`));
      if (command) console.log(`  ${command(g)}`);
      console.log('');
    }
  };
  print('Ready', ready, (g) => `node scripts/resolve-bank-deposit-duplicates.js --bank ${g.bankRow.id}`);
  print('Types differ: pick the right one', typed,
    (g) => `node scripts/resolve-bank-deposit-duplicates.js --bank ${g.bankRow.id} --type <${[...new Set(g.entries.map((t) => t.payment_type))].join('|')}>`);
  print('Needs review by hand (not resolvable by this script)', review);
}

async function main() {
  const bankTransactionId = arg('bank');
  if (!bankTransactionId) return report();

  const apply = process.argv.includes('--apply');
  const t = await sequelize.transaction();
  try {
    const log = await resolveDepositDuplicates({ bankTransactionId, paymentType: arg('type') || null }, t);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: resolve duplicates for bank row ${bankTransactionId}\n`);
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

module.exports = { findDepositDuplicates, resolveDepositDuplicates };
