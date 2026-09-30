/**
 * Deletes a transaction that turned out to be a duplicate of another one —
 * same steps the app's own deleteTransaction controller takes (DELETE
 * /api/transactions/:id), just runnable directly for a data-fix pass:
 *
 *   - refuses if the transaction has a pledge allocation (ON DELETE RESTRICT;
 *     reverse the allocation first — this isn't a payment you can just drop)
 *   - deletes its ledger entry(ies), then the transaction itself
 *
 * It does NOT touch the matching bank_transactions row or learned sender
 * keys — those describe the real-world deposit, which still happened; only
 * the double-recorded transaction/ledger entry goes away.
 *
 * One database transaction; dry run by default (performs and rolls back, so
 * its output is exactly what --apply will do), --apply to commit.
 *
 * From backend/:
 *   node scripts/delete-duplicate-transaction.js --transaction 560 --reason "Duplicate of #843 (bank-matched Zelle payment, same $190, one day later)"
 *   node scripts/delete-duplicate-transaction.js --transaction 560 --reason "..." --apply
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize, Transaction, LedgerEntry, PledgeAllocation } = require('../src/models');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** The deletion itself, inside the caller's transaction `t`. Exported for tests. */
async function deleteDuplicateTransaction({ transactionId, reason }, t) {
  const log = [];
  const opt = { transaction: t };

  const tx = await Transaction.findByPk(transactionId, { ...opt, lock: t.LOCK.UPDATE });
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  const allocationCount = await PledgeAllocation.count({ where: { transaction_id: tx.id }, ...opt });
  if (allocationCount > 0) {
    throw new Error(`Transaction ${transactionId} is allocated to a pledge (${allocationCount} allocation(s)); reverse it first.`);
  }

  const ledgerDeleted = await LedgerEntry.destroy({ where: { transaction_id: tx.id }, ...opt });
  log.push(`deleted ${ledgerDeleted} ledger entry(ies) for transaction ${tx.id}`);

  await tx.destroy(opt);
  log.push(`deleted transaction ${tx.id} ($${tx.amount}, ${tx.payment_type}, ${tx.payment_date})${reason ? ` — ${reason}` : ''}`);

  return log;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const transactionId = arg('transaction');
  const reason = arg('reason');
  if (!transactionId) {
    console.error('Usage: node scripts/delete-duplicate-transaction.js --transaction <id> [--reason "..."] [--apply]');
    process.exit(1);
  }

  const t = await sequelize.transaction();
  try {
    const log = await deleteDuplicateTransaction({ transactionId, reason }, t);
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: delete transaction ${transactionId}\n`);
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
      console.error('Delete failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { deleteDuplicateTransaction };
