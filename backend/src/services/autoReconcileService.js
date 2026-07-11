/**
 * Automatic bank reconciliation pass, run after every CSV upload (and on
 * demand via POST /api/bank/auto-reconcile).
 *
 * Processes PENDING bank transactions in three tiers, most confident first:
 *
 *  Tier 1 (credits, AUTO_LINKED):  exactly one existing system transaction
 *    matches (amount, method, date ±2 days, payer name) — typically a Zelle
 *    payment already created by the Gmail automation. Link it, create nothing.
 *
 *  Tier 2 (credits, AUTO_MEMBER):  a learned payer→member association
 *    (bank_memo_matches / zelle_memo_matches) points to exactly one member.
 *    Create the member transaction using their last-used payment type.
 *
 *  Tier 3 (debits, AUTO_EXPENSE):  a learned payee→GL mapping
 *    (expense_memo_matches) exists for the debit's normalized description.
 *    Record the expense ledger entry with the learned classification.
 *
 * Anything ambiguous (zero or multiple candidates, conflicting learned keys)
 * is left PENDING for the treasurer. Nothing is ever auto-ignored.
 * Every automatic action stores reconciled_source / reconciled_at /
 * reconciled_meta on the bank transaction so it can be audited and undone.
 */
const { Op } = require('sequelize');
const {
  BankTransaction,
  Transaction,
  LedgerEntry,
  ExpenseMemoMatch,
  ExpenseCategory,
  BankMemoMatch,
  ZelleMemoMatch,
  sequelize
} = require('../models');
const {
  findSuggestionCandidates,
  getBankMatchKeys,
  normalizeDescriptionForKey,
  sourceTypeFor
} = require('./bankMemoMatchService');
const { getDefaultPaymentType } = require('./zelleTransactionService');

// ---------------------------------------------------------------------------
// Expense learning
// ---------------------------------------------------------------------------

/**
 * Learn payee/description → expense classification from a manual
 * expense reconciliation.
 */
async function learnExpenseMemoMatch(bankTxn, { gl_code, payee_name, vendor_id, employee_id }) {
  if (!bankTxn || !gl_code) return [];

  const keys = getBankMatchKeys(bankTxn);
  const learned = [];
  for (const key of keys) {
    const [match] = await ExpenseMemoMatch.findOrCreate({
      where: { match_key: key.matchKey },
      defaults: {
        source_type: key.sourceType,
        gl_code,
        payee_name: payee_name || bankTxn.payer_name || null,
        vendor_id: vendor_id || null,
        employee_id: employee_id || null,
        raw_description: bankTxn.description || null,
        created_from_bank_transaction_id: bankTxn.id || null
      }
    });

    // Most recent manual classification wins
    if (match.gl_code !== gl_code
      || String(match.vendor_id || '') !== String(vendor_id || '')
      || String(match.employee_id || '') !== String(employee_id || '')) {
      await match.update({
        gl_code,
        payee_name: payee_name || match.payee_name,
        vendor_id: vendor_id || null,
        employee_id: employee_id || null,
        raw_description: bankTxn.description || match.raw_description
      });
    }
    learned.push(match);
  }
  return learned;
}

/**
 * Look up a learned expense classification for a bank debit.
 * Returns the mapping only when all matching keys agree on the GL code.
 */
async function findLearnedExpense(bankTxn) {
  const keys = getBankMatchKeys(bankTxn);
  if (keys.length === 0) return null;

  const matches = await ExpenseMemoMatch.findAll({
    where: { match_key: keys.map((key) => key.matchKey) }
  });
  if (matches.length === 0) return null;

  const glCodes = new Set(matches.map((m) => m.gl_code));
  if (glCodes.size > 1) return null; // conflicting learnings → leave for treasurer

  // Prefer the PAYER-keyed match for richer metadata
  const preferred = matches.find((m) => m.match_key.includes(':PAYER:')) || matches[0];
  return preferred;
}

// ---------------------------------------------------------------------------
// Expense recording (shared by manual reconcile-expense and the auto pass)
// ---------------------------------------------------------------------------

async function recordExpenseFromBankTxn(bankTxn, { gl_code, payee_name, vendor_id, employee_id, memo, check_number }, collectedBy, options = {}) {
  const t = options.transaction || null;

  const category = await ExpenseCategory.findOne({
    where: { gl_code, is_active: true },
    ...(t ? { transaction: t } : {})
  });
  if (!category) {
    throw new Error(`Invalid or inactive GL code: ${gl_code}`);
  }

  const sourceType = sourceTypeFor(bankTxn);
  let payment_method = 'other';
  if (sourceType === 'CHECK' || bankTxn.check_number) payment_method = 'check';
  else if (sourceType === 'ACH') payment_method = 'ach';

  const expense = await LedgerEntry.create({
    type: 'expense',
    category: gl_code,
    amount: Math.abs(Number(bankTxn.amount)),
    entry_date: bankTxn.date,
    payment_method,
    check_number: check_number || bankTxn.check_number || null,
    memo: memo || bankTxn.description,
    payee_name: payee_name || bankTxn.payer_name || null,
    vendor_id: vendor_id || null,
    employee_id: employee_id || null,
    external_id: bankTxn.transaction_hash,
    collected_by: collectedBy || null,
    source_system: 'bank_reconciliation'
  }, t ? { transaction: t } : {});

  return expense;
}

// ---------------------------------------------------------------------------
// The automatic pass
// ---------------------------------------------------------------------------

async function autoReconcileCredit(txn, user) {
  const plain = txn.get({ plain: true });
  const { findPotentialMatches, processReconciliation } = require('./reconciliationService');

  // Tier 0: exact Zelle reference match. The bank CSV carries the Zelle
  // transaction number (external_ref_id) and email-created transactions are
  // keyed `zelle:<number>` — an exact match is certain, regardless of any
  // date window (email date vs bank posting date can differ over weekends).
  if (plain.external_ref_id) {
    const byRef = await Transaction.findOne({
      where: { external_id: `zelle:${String(plain.external_ref_id).toUpperCase()}` }
    });
    if (byRef) {
      const prevExternalId = byRef.external_id;
      await processReconciliation({
        bankTxnId: txn.id,
        memberId: null,
        user,
        existingTransactionId: byRef.id
      });
      await txn.update({
        reconciled_source: 'AUTO_LINKED',
        reconciled_at: new Date(),
        reconciled_meta: {
          transaction_id: byRef.id,
          created: false,
          prev_external_id: prevExternalId,
          reason: 'Exact Zelle transaction number match'
        }
      });
      return 'AUTO_LINKED';
    }
  }

  // Tier 1: link to exactly one existing system transaction (e.g. a
  // Zelle payment the Gmail automation already created). For Zelle, use a
  // wider date window: the email arrives when the payment is sent, but the
  // bank may post it several days later (weekends/holidays). The Zelle
  // reference in the CSV is often the SENDER's bank reference and won't
  // match Chase's email transaction number, so Tier 0 can't always catch
  // these. Already-linked transactions are excluded, and any ambiguity
  // (more than one candidate) stays PENDING.
  const dayWindow = sourceTypeFor(plain) === 'ZELLE' ? 5 : 2;
  const potentials = await findPotentialMatches(plain, { dayWindow });
  if (potentials.length === 1) {
    const existing = potentials[0];
    const prevExternalId = existing.external_id || null;

    await processReconciliation({
      bankTxnId: txn.id,
      memberId: null,
      user,
      existingTransactionId: existing.id
    });

    await txn.update({
      reconciled_source: 'AUTO_LINKED',
      reconciled_at: new Date(),
      reconciled_meta: {
        transaction_id: existing.id,
        created: false,
        prev_external_id: prevExternalId,
        reason: 'Exactly one existing transaction matched amount, method, date and payer name'
      }
    });
    return 'AUTO_LINKED';
  }
  if (potentials.length > 1) {
    return null; // ambiguous — treasurer decides
  }

  // Tier 2: learned payer→member association, exactly one member.
  const suggestions = await findSuggestionCandidates(plain);
  const learned = suggestions.filter(
    (s) => s.confidence === 'high' && String(s.source || '').startsWith('LEARNED') && s.member?.id
  );
  const memberIds = new Set(learned.map((s) => String(s.member.id)));
  if (memberIds.size !== 1) {
    return null; // no learned match, or learned keys disagree
  }

  const memberId = learned[0].member.id;
  const { payment_type, for_year } = await getDefaultPaymentType(memberId, txn.date);

  const { donation } = await processReconciliation({
    bankTxnId: txn.id,
    memberId,
    paymentType: payment_type,
    user,
    forYear: for_year
  });

  await txn.update({
    reconciled_source: 'AUTO_MEMBER',
    reconciled_at: new Date(),
    reconciled_meta: {
      transaction_id: donation.id,
      created: true,
      member_id: memberId,
      payment_type,
      reason: learned[0].reason || 'Learned payer association'
    }
  });
  return 'AUTO_MEMBER';
}

async function autoReconcileDebit(txn, user) {
  // Dedupe: an expense for this bank row already exists
  const existingLedger = await LedgerEntry.findOne({
    where: { external_id: txn.transaction_hash }
  });
  if (existingLedger) {
    await txn.update({
      status: 'MATCHED',
      reconciled_source: 'AUTO_EXPENSE',
      reconciled_at: new Date(),
      reconciled_meta: {
        ledger_entry_id: existingLedger.id,
        created: false,
        reason: 'Expense ledger entry already existed for this bank transaction'
      }
    });
    return 'AUTO_EXPENSE';
  }

  const mapping = await findLearnedExpense(txn);
  if (!mapping) return null;

  const expense = await recordExpenseFromBankTxn(txn, {
    gl_code: mapping.gl_code,
    payee_name: mapping.payee_name,
    vendor_id: mapping.vendor_id,
    employee_id: mapping.employee_id
  }, user?.id || null);

  await txn.update({
    status: 'MATCHED',
    reconciled_source: 'AUTO_EXPENSE',
    reconciled_at: new Date(),
    reconciled_meta: {
      ledger_entry_id: expense.id,
      created: true,
      gl_code: mapping.gl_code,
      reason: 'Learned payee/description → GL classification'
    }
  });
  return 'AUTO_EXPENSE';
}

/**
 * Run the pass over all PENDING bank transactions (optionally restricted to
 * specific ids). Returns stats for display after upload.
 */
async function autoReconcilePending({ user, transactionIds = null } = {}) {
  const where = { status: 'PENDING' };
  if (Array.isArray(transactionIds) && transactionIds.length > 0) {
    where.id = { [Op.in]: transactionIds };
  }

  const pending = await BankTransaction.findAll({
    where,
    order: [['date', 'ASC'], ['id', 'ASC']]
  });

  const stats = {
    examined: pending.length,
    autoLinked: 0,
    autoMember: 0,
    autoExpense: 0,
    needsReview: 0,
    errors: 0
  };

  for (const txn of pending) {
    try {
      const isCredit = Number(txn.amount) > 0;
      const result = isCredit
        ? await autoReconcileCredit(txn, user)
        : await autoReconcileDebit(txn, user);

      if (result === 'AUTO_LINKED') stats.autoLinked += 1;
      else if (result === 'AUTO_MEMBER') stats.autoMember += 1;
      else if (result === 'AUTO_EXPENSE') stats.autoExpense += 1;
      else stats.needsReview += 1;
    } catch (e) {
      stats.errors += 1;
      console.error(`Auto-reconcile error for bank txn ${txn.id}:`, e.message || e);
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Undo an automatic reconciliation
// ---------------------------------------------------------------------------

async function undoAutoReconciliation(bankTxnId) {
  const txn = await BankTransaction.findByPk(bankTxnId);
  if (!txn) throw new Error('Bank transaction not found');
  if (txn.status !== 'MATCHED' || !String(txn.reconciled_source || '').startsWith('AUTO_')) {
    throw new Error('Only automatically reconciled transactions can be undone');
  }

  const meta = txn.reconciled_meta || {};
  const source = txn.reconciled_source;

  if (source === 'AUTO_LINKED') {
    // The system transaction pre-existed — just unlink it.
    const donation = meta.transaction_id ? await Transaction.findByPk(meta.transaction_id) : null;
    if (donation && donation.external_id === txn.transaction_hash) {
      await donation.update({ external_id: meta.prev_external_id || null });
      const ledger = await LedgerEntry.findOne({ where: { transaction_id: donation.id } });
      if (ledger && ledger.external_id === txn.transaction_hash) {
        await ledger.update({ external_id: meta.prev_external_id || null });
      }
    }
  } else if (source === 'AUTO_MEMBER') {
    // The transaction was created by the auto pass — remove it, and forget
    // the learned keys so the next upload doesn't repeat the mistake.
    if (meta.created && meta.transaction_id) {
      await LedgerEntry.destroy({ where: { transaction_id: meta.transaction_id } });
      await Transaction.destroy({ where: { id: meta.transaction_id } });
    }
    if (meta.member_id) {
      const keys = getBankMatchKeys(txn.get({ plain: true }));
      if (keys.length > 0) {
        await BankMemoMatch.destroy({
          where: {
            match_key: keys.map((key) => key.matchKey),
            member_id: meta.member_id
          }
        });
      }
      const legacyMemo = normalizeDescriptionForKey(txn.description, sourceTypeFor(txn));
      if (legacyMemo) {
        await ZelleMemoMatch.destroy({
          where: {
            member_id: meta.member_id,
            [Op.and]: [sequelize.where(sequelize.fn('lower', sequelize.col('memo')), legacyMemo.toLowerCase())]
          }
        });
      }
    }
  } else if (source === 'AUTO_EXPENSE') {
    if (meta.created && meta.ledger_entry_id) {
      await LedgerEntry.destroy({ where: { id: meta.ledger_entry_id } });
    }
    // Forget the learned classification for these keys so it isn't repeated.
    const keys = getBankMatchKeys(txn.get({ plain: true }));
    if (keys.length > 0 && meta.created) {
      await ExpenseMemoMatch.destroy({
        where: { match_key: keys.map((key) => key.matchKey) }
      });
    }
  }

  await txn.update({
    status: 'PENDING',
    member_id: null,
    reconciled_source: null,
    reconciled_at: null,
    reconciled_meta: null
  });

  return txn;
}

module.exports = {
  autoReconcilePending,
  undoAutoReconciliation,
  learnExpenseMemoMatch,
  findLearnedExpense,
  recordExpenseFromBankTxn
};
