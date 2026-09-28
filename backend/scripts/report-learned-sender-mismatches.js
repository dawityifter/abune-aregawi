/**
 * READ-ONLY review of learned Zelle/bank senders that may be wrong.
 *
 * Lists every learned payer key (bank_memo_matches, "<SOURCE>:PAYER:<name>")
 * whose payer name does not resemble the member it is remembered for. Those
 * are either real relationships (a spouse paying from their own account) or
 * one-off "paid on behalf of" payments that the old code wrongly learned.
 * Only a person can tell which — this report gives the evidence:
 *
 *   RE-POINTED        the key was changed after it was first learned (what an
 *                     on-behalf approval used to do to a known sender)
 *   LEGACY-DISAGREES  the legacy zelle_memo_matches row for the same payer
 *                     names someone else
 *   credited to       who this payer's bank payments were actually credited
 *                     to, and how often
 *   name resembles    members whose name looks like the payer's
 *
 * To make a one-off payment stop steering future matches, run
 * scripts/unlearn-on-behalf-payment.js on it (suggested command printed).
 * To keep a real relationship, do nothing.
 *
 * Writes nothing. On PostgreSQL the queries run in a READ ONLY transaction.
 *
 * From backend/:
 *   node scripts/report-learned-sender-mismatches.js
 *   node scripts/report-learned-sender-mismatches.js --all   # include keys that resemble their member
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const models = require('../src/models');
const { normalizeWords, payerResemblesMember } = require('../src/services/bankMemoMatchService');

const { sequelize, BankMemoMatch, ZelleMemoMatch, BankTransaction, Transaction, Member } = models;

const name = (m) => (m ? `${m.first_name} ${m.last_name} (#${m.id})` : 'unknown member');
const REPOINT_SLACK_MS = 60 * 1000;

/**
 * The report rows. Exported for tests.
 */
async function buildReport({ includeResembling = false } = {}, t = null) {
  const opt = t ? { transaction: t } : {};

  const keys = await BankMemoMatch.findAll({
    where: { match_key: { [Op.like]: '%:PAYER:%' } }, order: [['match_key', 'ASC']], ...opt
  });
  const members = await Member.findAll({ attributes: ['id', 'first_name', 'last_name'], ...opt });
  const memberById = new Map(members.map((m) => [String(m.id), m]));

  const legacyByPayer = new Map();
  for (const row of await ZelleMemoMatch.findAll({ attributes: ['member_id', 'memo'], ...opt })) {
    legacyByPayer.set(normalizeWords(row.memo), String(row.member_id));
  }

  // Who each payer's bank payments were credited to.
  const creditedByPayer = new Map();
  const bankRows = await BankTransaction.findAll({
    where: { status: 'MATCHED', payer_name: { [Op.ne]: null } },
    attributes: ['id', 'date', 'payer_name', 'member_id', 'transaction_hash'],
    order: [['date', 'DESC'], ['id', 'DESC']],
    ...opt
  });
  for (const row of bankRows) {
    const payer = normalizeWords(row.payer_name);
    if (!creditedByPayer.has(payer)) creditedByPayer.set(payer, []);
    creditedByPayer.get(payer).push(row);
  }

  const rows = [];
  for (const key of keys) {
    const [sourceType, payer] = key.match_key.split(':PAYER:');
    const member = memberById.get(String(key.member_id));
    const resembles = payerResemblesMember(payer, member);
    const createdAt = key.get('createdAt');
    const updatedAt = key.get('updatedAt');
    const repointed = createdAt && updatedAt && (new Date(updatedAt) - new Date(createdAt)) > REPOINT_SLACK_MS;
    const legacyOwner = legacyByPayer.get(payer);
    const legacyDisagrees = !!legacyOwner && legacyOwner !== String(key.member_id);
    if (resembles && !repointed && !legacyDisagrees && !includeResembling) continue;

    const credits = creditedByPayer.get(payer) || [];
    const counts = new Map();
    credits.forEach((r) => counts.set(String(r.member_id), (counts.get(String(r.member_id)) || 0) + 1));

    // The latest payment from this payer credited to the remembered member —
    // the one to unlearn if the relationship was a one-off.
    const latestForMember = credits.find((r) => String(r.member_id) === String(key.member_id));
    const latestTx = latestForMember
      ? await Transaction.findOne({ where: { external_id: latestForMember.transaction_hash }, attributes: ['id'], ...opt })
      : null;

    rows.push({
      match_key: key.match_key,
      source_type: sourceType,
      payer,
      member,
      resembles,
      repointed: !!repointed,
      legacy_owner: legacyDisagrees ? memberById.get(legacyOwner) || { id: legacyOwner } : null,
      credited: [...counts.entries()].map(([id, n]) => ({ member: memberById.get(id) || { id }, count: n })),
      resembling_members: members.filter((m) => payerResemblesMember(payer, m)),
      latest_transaction_id: latestTx?.id || null,
      learned_at: createdAt,
      changed_at: repointed ? updatedAt : null
    });
  }

  // Strongest signals of a wrongly learned key first.
  const score = (r) => (r.repointed ? 2 : 0) + (r.legacy_owner ? 2 : 0) + (r.resembling_members.length > 0 && !r.resembles ? 1 : 0);
  return rows.sort((a, b) => score(b) - score(a) || a.payer.localeCompare(b.payer));
}

function printReport(rows) {
  if (rows.length === 0) {
    console.log('No learned senders to review.');
    return;
  }
  console.log(`${rows.length} learned sender(s) to review:\n`);
  rows.forEach((r, i) => {
    const flags = [r.repointed && 'RE-POINTED', r.legacy_owner && 'LEGACY-DISAGREES', !r.resembles && 'NAME-DIFFERS']
      .filter(Boolean).join(', ');
    console.log(`${i + 1}. ${r.source_type} payer "${r.payer}" -> remembered for ${name(r.member)}${flags ? `   [${flags}]` : ''}`);
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '?');
    console.log(`   learned ${day(r.learned_at)}${r.changed_at ? `, re-pointed ${day(r.changed_at)}` : ''}`);
    if (r.legacy_owner) console.log(`   legacy memo says: ${name(r.legacy_owner)}`);
    console.log(`   credited to: ${r.credited.length ? r.credited.map((c) => `${name(c.member)} x${c.count}`).join(', ') : 'no matched bank payments'}`);
    console.log(`   name resembles: ${r.resembling_members.length ? r.resembling_members.map(name).join(', ') : 'no member'}`);
    if (r.latest_transaction_id && !r.resembles) {
      const sender = r.resembling_members.length === 1 ? r.resembling_members[0].id : '<memberId|none>';
      console.log(`   if that was a one-off: node scripts/unlearn-on-behalf-payment.js --transaction ${r.latest_transaction_id} --sender ${sender} --by <yourMemberId>`);
    }
    console.log('');
  });
}

async function main() {
  const includeResembling = process.argv.includes('--all');
  sequelize.options.logging = false; // the report is the output
  const t = await sequelize.transaction();
  try {
    if (sequelize.getDialect() === 'postgres') {
      await sequelize.query('SET TRANSACTION READ ONLY', { transaction: t });
    }
    printReport(await buildReport({ includeResembling }, t));
  } finally {
    await t.rollback();
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Report failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { buildReport };
