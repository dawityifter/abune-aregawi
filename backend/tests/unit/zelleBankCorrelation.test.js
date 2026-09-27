const { Member, Transaction, ZelleEmailQueue, BankTransaction } = require('../../src/models');
const {
  findEmailPaymentsForBankRow,
  findBankRowsForQueueRow,
  samePayer
} = require('../../src/services/zelleBankCorrelationService');

// All data synthetic.
let member;
let seq = 0;

async function emailPayment({ ref, payer = 'JANE SAMPLE', amount = 50, date = '2026-08-03', created = true, txExternalId } = {}) {
  seq += 1;
  const external_id = ref ? `zelle:${ref}` : `gmail:<msg-${seq}@example.com>`;
  let tx = null;
  if (created) {
    tx = await Transaction.create({
      member_id: member.id,
      collected_by: member.id,
      amount,
      payment_date: date,
      payment_type: 'donation',
      payment_method: 'zelle',
      status: 'succeeded',
      external_id: txExternalId || external_id
    });
  }
  return ZelleEmailQueue.create({
    external_id,
    payer_name: payer,
    amount,
    payment_date: date,
    status: created ? 'CREATED' : 'NEEDS_REVIEW',
    transaction_id: tx ? tx.id : null
  });
}

async function bankRow({ ref = `ZZ${String(seq += 1).padStart(10, '0')}`, payer = 'JANE SAMPLE', amount = 50, date = '2026-08-04', status = 'PENDING' } = {}) {
  seq += 1;
  return BankTransaction.create({
    transaction_hash: `hash-${seq}-${Math.random().toString(16).slice(2)}`,
    date,
    amount,
    description: `Zelle payment from ${payer} ${ref}`,
    type: 'ZELLE',
    status,
    payer_name: payer,
    external_ref_id: ref
  });
}

beforeAll(async () => {
  member = await Member.create({
    first_name: 'Corr', last_name: 'Member', phone_number: '+15555550171', is_active: true
  });
});

beforeEach(async () => {
  await ZelleEmailQueue.destroy({ where: {} });
  await BankTransaction.destroy({ where: {} });
  await Transaction.destroy({ where: {} });
});

describe('samePayer', () => {
  test('ignores case, punctuation and spacing', () => {
    expect(samePayer('Jane  Sample', 'JANE SAMPLE')).toBe(true);
    expect(samePayer("O'NEIL J.", 'O NEIL J')).toBe(true);
    expect(samePayer('JANE SAMPLE', 'JANE SAMPLES')).toBe(false);
    expect(samePayer('', '')).toBe(false);
  });
});

describe('bank row -> email-created transaction', () => {
  test('EXACT_REF when the bank reference is the email Transaction number', async () => {
    const q = await emailPayment({ ref: '12345678901', payer: 'SOMEONE ELSE' });
    const b = await bankRow({ ref: '12345678901', payer: 'DIFFERENT NAME', date: '2026-08-20' });

    const res = await findEmailPaymentsForBankRow(b);
    expect(res.tier).toBe('EXACT_REF');
    expect(res.matches[0].queueRow.id).toBe(q.id);
  });

  test('ANCHORED on amount + payer + window when unique both ways', async () => {
    const q = await emailPayment({ ref: '11111111111' });
    const b = await bankRow({ ref: 'ABCDEFGHJKLM', date: '2026-08-06' });

    const res = await findEmailPaymentsForBankRow(b);
    expect(res.tier).toBe('ANCHORED');
    expect(String(res.matches[0].transaction.id)).toBe(String(q.transaction_id));
  });

  test('no match outside the window (1 day before .. 5 after)', async () => {
    await emailPayment({ ref: '11111111112', date: '2026-08-03' });
    expect((await findEmailPaymentsForBankRow(await bankRow({ date: '2026-08-09' }))).tier).toBeNull();
    expect((await findEmailPaymentsForBankRow(await bankRow({ date: '2026-08-01' }))).tier).toBeNull();
    expect((await findEmailPaymentsForBankRow(await bankRow({ date: '2026-08-02' }))).tier).toBe('ANCHORED');
  });

  test('CANDIDATES when two emails fit, even if only one has a transaction', async () => {
    await emailPayment({ ref: '22222222221', date: '2026-08-03' });
    await emailPayment({ ref: '22222222222', date: '2026-08-04', created: false });
    const res = await findEmailPaymentsForBankRow(await bankRow({ date: '2026-08-05' }));
    expect(res.tier).toBe('CANDIDATES');
    expect(res.matches).toHaveLength(1);
  });

  test('CANDIDATES when the email also fits another pending bank row', async () => {
    await emailPayment({ ref: '33333333331' });
    const b1 = await bankRow({ date: '2026-08-04' });
    await bankRow({ date: '2026-08-05' });
    expect((await findEmailPaymentsForBankRow(b1)).tier).toBe('CANDIDATES');
  });

  test('ignores transactions the bank already confirmed', async () => {
    await emailPayment({ ref: '44444444441', txExternalId: 'a'.repeat(32) });
    expect((await findEmailPaymentsForBankRow(await bankRow())).tier).toBeNull();
  });

  test('ignores debits and non-Zelle credits', async () => {
    await emailPayment({ ref: '55555555551' });
    const ach = await bankRow();
    await ach.update({ type: 'ACH_CREDIT', description: 'ORIG CO NAME:SOMETHING' });
    expect((await findEmailPaymentsForBankRow(ach)).tier).toBeNull();
  });
});

describe('email -> bank row', () => {
  test('EXACT_REF finds the bank row and the transaction it is reconciled to', async () => {
    const q = await emailPayment({ ref: '66666666661', created: false });
    const b = await bankRow({ ref: '66666666661', status: 'MATCHED' });
    const tx = await Transaction.create({
      member_id: member.id, collected_by: member.id, amount: 50, payment_date: '2026-08-04',
      payment_type: 'donation', payment_method: 'zelle', status: 'succeeded', external_id: b.transaction_hash
    });

    const res = await findBankRowsForQueueRow(q);
    expect(res.tier).toBe('EXACT_REF');
    expect(res.matches[0].bankRow.id).toBe(b.id);
    expect(res.matches[0].transaction.id).toBe(tx.id);
  });

  test('ANCHORED to a single pending row; transaction is null', async () => {
    const q = await emailPayment({ ref: '77777777771', created: false });
    const b = await bankRow({ ref: 'QWERTYUIOPAS' });
    const res = await findBankRowsForQueueRow(q);
    expect(res.tier).toBe('ANCHORED');
    expect(res.matches[0].bankRow.id).toBe(b.id);
    expect(res.matches[0].transaction).toBeNull();
  });

  test('skips bank rows already paired with another email', async () => {
    const other = await emailPayment({ ref: '88888888881', created: false });
    const b = await bankRow();
    await other.update({ bank_transaction_id: b.id });
    const q = await emailPayment({ ref: '88888888882', created: false });
    expect((await findBankRowsForQueueRow(q)).tier).toBeNull();
  });

  test('no anchor without a payer name', async () => {
    const q = await emailPayment({ ref: '99999999991', created: false, payer: null });
    await bankRow();
    expect((await findBankRowsForQueueRow(q)).tier).toBeNull();
  });
});
