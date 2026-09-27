/**
 * Confirms an email-created Zelle transaction against its bank row: the one
 * write path shared by "Create" on the Zelle Review screen (when the bank row
 * is already uploaded) and the bank reconciliation pass (when it arrives
 * later).
 *
 * The transaction is updated in place, never duplicated:
 *  - its external_id becomes the bank hash (the system-wide "bank-confirmed"
 *    marker), with the email key kept in reconciled_meta for undo;
 *  - member, payment type, year, receipt and payment_date stay as the
 *    treasurer set them — payment_date is when the donor gave;
 *  - the ledger entry records the bank posting date as statement_date;
 *  - the queue row records which bank row confirmed it.
 */
const { LedgerEntry } = require('../models');

async function linkEmailPaymentToBankRow({ queueRow, transaction, bankRow, tier, user }) {
  const { processReconciliation } = require('./reconciliationService');
  const prevExternalId = transaction.external_id || null;

  await processReconciliation({
    bankTxnId: bankRow.id,
    memberId: null,
    user,
    existingTransactionId: transaction.id
  });

  await bankRow.update({
    reconciled_source: 'AUTO_LINKED',
    reconciled_at: new Date(),
    reconciled_meta: {
      transaction_id: transaction.id,
      created: false,
      prev_external_id: prevExternalId,
      zelle_queue_id: queueRow.id,
      reason: tier === 'EXACT_REF'
        ? 'Zelle email with the same transaction number'
        : 'Zelle email with the same payer, amount and date window'
    }
  });

  await queueRow.update({ bank_transaction_id: bankRow.id });

  await LedgerEntry.update(
    { statement_date: bankRow.date },
    { where: { transaction_id: transaction.id } }
  );

  return { bank_transaction_id: bankRow.id, tier };
}

module.exports = { linkEmailPaymentToBankRow };
