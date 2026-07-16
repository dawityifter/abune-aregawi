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
  learnBankMemoMatch,
  normalizeDescriptionForKey,
  normalizeWords,
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

async function autoReconcileCredit(txn, user, { linkOnly = false } = {}) {
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

  // Link-only mode (targeted linking after a Zelle transaction is created):
  // never fall through to Tier 2, which would CREATE transactions for other
  // learned payers that merely share the amount/date window.
  if (linkOnly) {
    return null;
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

  // Link-first: if this learned member already has an unlinked transaction
  // matching this row's amount and date window, LINK it instead of creating.
  // Tier 1 can't see such transactions when the bank payer's name differs
  // from the member's registered name (family members often send from
  // accounts under other names) — creating here would double-post the
  // payment the treasurer already recorded from the Zelle review screen.
  {
    const rowDate = new Date(plain.date);
    const startDate = new Date(rowDate); startDate.setDate(startDate.getDate() - dayWindow);
    const endDate = new Date(rowDate); endDate.setDate(endDate.getDate() + dayWindow);
    const unlinkedForMember = (await Transaction.findAll({
      where: {
        member_id: memberId,
        amount: plain.amount,
        payment_method: sourceTypeFor(plain).toLowerCase(),
        payment_date: { [Op.between]: [startDate, endDate] },
        status: { [Op.ne]: 'failed' }
      },
      order: [['payment_date', 'ASC'], ['id', 'ASC']]
    })).filter((t) => t.external_id !== plain.transaction_hash && !/^[a-f0-9]{32}$/i.test(String(t.external_id || '')));

    if (unlinkedForMember.length > 0) {
      const existing = unlinkedForMember[0]; // oldest first: double payments consume in order
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
          member_id: memberId,
          reason: 'Learned payer; linked existing unlinked transaction for the member'
        }
      });
      return 'AUTO_LINKED';
    }
  }

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
/**
 * Targeted linking: after a Zelle transaction is created (review screen or
 * Gmail automation), immediately try to link any matching PENDING bank rows
 * so the Bank Transactions screen reflects the match right away instead of
 * waiting for an on-demand auto-reconcile run.
 *
 * Candidates are prefiltered cheaply (PENDING credits with the same amount in
 * a generous date window); autoReconcileCredit's Tier 0/1 then decides with
 * its usual certainty rules. linkOnly prevents Tier 2 from creating
 * transactions for unrelated learned payers that share the amount.
 */
async function linkPendingBankRowsForTransaction(tx, user, { dayWindow = 7, maxCandidates = 10, payerName = null } = {}) {
  const paymentDate = new Date(tx.payment_date);
  if (Number.isNaN(paymentDate.getTime())) return { linked: 0, examined: 0 };
  const start = new Date(paymentDate.getTime() - dayWindow * 24 * 60 * 60 * 1000);
  const end = new Date(paymentDate.getTime() + dayWindow * 24 * 60 * 60 * 1000);

  const candidates = await BankTransaction.findAll({
    where: {
      status: 'PENDING',
      amount: Number(tx.amount),
      date: { [Op.gte]: start, [Op.lte]: end }
    },
    order: [['date', 'ASC'], ['id', 'ASC']],
    limit: maxCandidates
  });

  let linked = 0;
  let linkedRow = null;
  for (const row of candidates) {
    try {
      const result = await autoReconcileCredit(row, user, { linkOnly: true });
      if (result === 'AUTO_LINKED') {
        linked += 1;
        if (!linkedRow) linkedRow = row;
      }
    } catch (e) {
      console.error(`Targeted bank link failed for bank txn ${row.id}:`, e.message || e);
    }
  }

  // Tier 1.5 (targeted only): the treasurer explicitly matched THIS payment.
  // When the Zelle memo (or parsed payer) CONTAINS a candidate row's payer
  // name, that row is this payment — even though the sender's bank name
  // doesn't match the member's registered name (family members often send
  // from accounts under other names), which makes Tier 1's name rule fail.
  if (linked === 0) {
    const anchorText = ` ${normalizeWords(`${payerName || ''} ${tx.note || ''}`)} `;
    if (anchorText.trim()) {
      const anchored = candidates.filter((row) => {
        if (row.status !== 'PENDING') return false;
        const rowPayer = normalizeWords(row.payer_name || '');
        return rowPayer.length >= 5 && anchorText.includes(` ${rowPayer} `);
      });
      if (anchored.length > 0) {
        const row = anchored[0]; // oldest first
        try {
          const { processReconciliation } = require('./reconciliationService');
          const prevExternalId = tx.external_id || null;
          await processReconciliation({
            bankTxnId: row.id,
            memberId: null,
            user,
            existingTransactionId: tx.id
          });
          await row.update({
            reconciled_source: 'AUTO_LINKED',
            reconciled_at: new Date(),
            reconciled_meta: {
              transaction_id: tx.id,
              created: false,
              prev_external_id: prevExternalId,
              reason: 'Zelle memo contains the bank payer name'
            }
          });
          linked += 1;
          linkedRow = row;
        } catch (e) {
          console.error(`Anchored bank link failed for bank txn ${row.id}:`, e.message || e);
        }
      }
    }
  }

  // Learn payer → member from the row we actually linked, so the payer's
  // remaining and future rows surface suggestions / Tier-2 auto-creation.
  if (linkedRow && tx.member_id) {
    try {
      await learnBankMemoMatch(linkedRow.get({ plain: true }), tx.member_id);
    } catch (e) {
      console.warn('Targeted link learning warning:', e.message || e);
    }
  }

  return { linked, examined: candidates.length };
}

async function autoReconcilePending({ user, transactionIds = null, limit = null, afterId = null } = {}) {
  const stats = {
    examined: 0,
    autoLinked: 0,
    autoMember: 0,
    autoExpense: 0,
    needsReview: 0,
    errors: 0,
    // Batching cursor: when done=false, call again with afterId=nextAfterId to continue.
    done: true,
    nextAfterId: null
  };

  const where = { status: 'PENDING' };
  if (Array.isArray(transactionIds)) {
    // An explicitly-empty id list means "nothing to reconcile" — never fall
    // through to a full-backlog scan (that scan is what timed uploads out).
    if (transactionIds.length === 0) {
      return stats;
    }
    where.id = { [Op.in]: transactionIds };
  } else if (afterId !== null && afterId !== undefined && afterId !== '') {
    where.id = { [Op.gt]: afterId };
  }

  // Bounded batch mode: order by id so afterId is a stable cursor, and fetch
  // one extra row to detect whether more remain without a second COUNT query.
  const batchLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.floor(Number(limit))
    : null;

  const pending = await BankTransaction.findAll({
    where,
    order: batchLimit ? [['id', 'ASC']] : [['date', 'ASC'], ['id', 'ASC']],
    ...(batchLimit ? { limit: batchLimit + 1 } : {})
  });

  if (batchLimit && pending.length > batchLimit) {
    pending.length = batchLimit; // drop the extra look-ahead row
    stats.done = false;
  }

  stats.examined = pending.length;
  if (pending.length > 0) {
    stats.nextAfterId = pending[pending.length - 1].id;
  }

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
  linkPendingBankRowsForTransaction,
  undoAutoReconciliation,
  learnExpenseMemoMatch,
  findLearnedExpense,
  recordExpenseFromBankTxn
};
