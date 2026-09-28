const { Op } = require('sequelize');
const { BankMemoMatch, Member, ZelleMemoMatch, sequelize } = require('../models');

const ACH_STOP_MARKERS = [
  ' WEB ID:',
  ' CO ID:',
  ' COMPANY ID:',
  ' IND ID:',
  ' TRACE',
  ' TRN',
  ' ENTRY',
  ' CCD',
  ' PPD',
  ' SEC:'
];

function normalizeWords(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractAchIndividualName(description) {
  const raw = String(description || '');
  const marker = raw.search(/IND NAME:/i);
  if (marker === -1) return null;

  const start = marker + 'IND NAME:'.length;
  const remainder = raw.slice(start);
  const upperRemainder = remainder.toUpperCase();
  const stopAt = ACH_STOP_MARKERS
    .map((stop) => upperRemainder.indexOf(stop))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];

  const extracted = (stopAt >= 0 ? remainder.slice(0, stopAt) : remainder)
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!extracted) return null;
  return extracted.replace(/\s*,\s*/g, ', ').trim();
}

function sourceTypeFor(transaction) {
  const type = String(transaction?.type || '').toUpperCase();
  const desc = String(transaction?.description || '');
  if (type.includes('ZELLE') || /^Zelle payment from/i.test(desc)) return 'ZELLE';
  if (type.includes('ACH') || /(?:ORIG CO NAME:|IND NAME:|ACH)/i.test(desc)) return 'ACH';
  if (type.includes('CHECK') || /^CHECK\s+\d+/i.test(desc)) return 'CHECK';
  return type || 'UNKNOWN';
}

function normalizeDescriptionForKey(description, sourceType) {
  let clean = String(description || '');

  if (sourceType === 'ZELLE') {
    clean = clean.replace(/^Zelle payment from\s+/i, '');
    clean = clean.replace(/\s+\w{6,}$/, '');
  } else if (sourceType === 'ACH') {
    clean = clean
      .replace(/ORIG CO NAME:/ig, ' ')
      .replace(/IND NAME:/ig, ' ')
      .replace(/WEB ID:[^\s]+/ig, ' ')
      .replace(/CO ID:[^\s]+/ig, ' ')
      .replace(/COMPANY ID:[^\s]+/ig, ' ')
      .replace(/IND ID:[^\s]+/ig, ' ')
      .replace(/TRACE[^\s]*/ig, ' ')
      .replace(/TRN[^\s]*/ig, ' ');
  } else if (sourceType.includes('CARD')) {
    // A card purchase description ends with a tail that belongs to the
    // transaction rather than the merchant:
    //
    //   Spectrum 855-707-7328 MO                     09/28
    //   THE HOME DEPOT #0550 DALLAS TX       002096  05/15
    //   DNH*GODADDY#4038200691 480-5058855 AZ        03/18
    //
    // The posting date changes every month and the auth reference changes
    // every charge, so keeping them made each visit from the same merchant
    // learn a key that could never match again — which is why a repeat card
    // charge was never recognized.
    //
    // Only a digit run the description ENDS on is stripped: a phone number is
    // part of the merchant's identity, and a store number (#0550) stays so one
    // chain's locations remain separately classifiable.
    clean = clean
      .replace(/\s+\d{1,2}\/\d{1,2}\s*$/, '')  // posting date
      .replace(/\s+\d{4,}\s*$/, '')            // auth reference the date hid
      .replace(/#\d{7,}/g, ' ');               // order number on the merchant
  } else {
    clean = clean
      .replace(/^CHECK\s+\d+\s*/i, '')
      .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '')
      .replace(/\s+\d{6,}$/, '');
  }

  return normalizeWords(clean);
}

function getBankMatchKeys(transaction) {
  const sourceType = sourceTypeFor(transaction);
  const payerName = transaction?.payer_name || (sourceType === 'ACH' ? extractAchIndividualName(transaction?.description) : null);
  const keys = [];

  if (payerName) {
    keys.push({
      sourceType,
      keyType: 'PAYER',
      matchKey: `${sourceType}:PAYER:${normalizeWords(payerName)}`,
      label: payerName
    });
  }

  const normalizedDescription = normalizeDescriptionForKey(transaction?.description, sourceType);
  if (normalizedDescription) {
    keys.push({
      sourceType,
      keyType: 'DESCRIPTION',
      matchKey: `${sourceType}:DESCRIPTION:${normalizedDescription}`,
      label: transaction?.description || null
    });
  }

  const unique = new Map();
  keys.forEach((key) => {
    if (!unique.has(key.matchKey)) unique.set(key.matchKey, key);
  });
  return Array.from(unique.values());
}

function normalizeLegacyMemo(description, sourceType) {
  return normalizeDescriptionForKey(description, sourceType);
}

async function buildCandidateFromMember(member, source, reason, confidence, extra = {}) {
  if (!member) return null;
  return {
    type: source,
    source,
    reason,
    confidence,
    member: {
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name
    },
    ...extra
  };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.member?.id) return false;
    const key = `${candidate.source}:${candidate.member.id}:${candidate.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findLearnedCandidates(transaction) {
  const keys = getBankMatchKeys(transaction);
  if (keys.length === 0) return [];

  const learnedMatches = await BankMemoMatch.findAll({
    where: { match_key: keys.map((key) => key.matchKey) },
    include: [{
      model: Member,
      as: 'member',
      attributes: ['id', 'first_name', 'last_name']
    }]
  });

  const keyByValue = new Map(keys.map((key) => [key.matchKey, key]));
  const candidates = learnedMatches.map((match) => {
    const key = keyByValue.get(match.match_key);
    return buildCandidateFromMember(
      match.member,
      `LEARNED_${match.source_type}`,
      key?.keyType === 'PAYER'
        ? `Previously associated with this ${match.source_type} payer`
        : `Previously associated with this ${match.source_type} description`,
      'high',
      { match_key: match.match_key }
    );
  });

  const sourceType = sourceTypeFor(transaction);
  if (sourceType === 'ZELLE') {
    const legacyMemo = normalizeLegacyMemo(transaction.description, sourceType);
    if (legacyMemo) {
      const legacy = await ZelleMemoMatch.findOne({
        where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), legacyMemo.toLowerCase()),
        include: [{
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name']
        }]
      });
      if (legacy?.member) {
        candidates.push(buildCandidateFromMember(
          legacy.member,
          'LEARNED_ZELLE',
          'Previously associated with this Zelle memo',
          'high',
          { match_key: `ZELLE:LEGACY:${legacyMemo}` }
        ));
      }
    }
  }

  return dedupeCandidates(await Promise.all(candidates));
}

async function findFuzzyMemberCandidates(nameText) {
  const normalized = normalizeWords(nameText);
  const tokens = normalized.split(' ').filter((token) => token.length > 2);
  if (tokens.length === 0) return [];

  const tokenClauses = tokens.map((token) => ({
    [Op.or]: [
      { first_name: { [sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like]: `%${token}%` } },
      { last_name: { [sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like]: `%${token}%` } }
    ]
  }));

  return Member.findAll({
    where: { [Op.and]: tokenClauses },
    attributes: ['id', 'first_name', 'last_name'],
    limit: 5
  });
}

async function findSuggestionCandidates(transaction) {
  const sourceType = sourceTypeFor(transaction);
  const learnedCandidates = await findLearnedCandidates(transaction);

  // Learned records that name different members for one sender (e.g. a key
  // re-pointed by a one-off "paid on behalf" payment while the legacy memo
  // still names the sender) are evidence of nothing. Neither may drive a
  // high-confidence pre-fill or an automatic action; both are shown.
  if (new Set(learnedCandidates.map((c) => String(c.member.id))).size > 1) {
    for (const candidate of learnedCandidates) {
      candidate.confidence = 'medium';
      candidate.conflict = true;
      candidate.reason = `${candidate.reason} (learned records disagree)`;
    }
  }

  const candidates = [...learnedCandidates];
  const fuzzyName = transaction.payer_name || (sourceType === 'ACH' ? extractAchIndividualName(transaction.description) : null);

  if (fuzzyName) {
    const members = await findFuzzyMemberCandidates(fuzzyName);
    for (const member of members) {
      candidates.push(await buildCandidateFromMember(
        member,
        'FUZZY_NAME',
        `${sourceType} payer name resembles this member`,
        members.length === 1 ? 'medium' : 'low'
      ));
    }
  }

  if (!fuzzyName && transaction.description) {
    const members = await findFuzzyMemberCandidates(normalizeDescriptionForKey(transaction.description, sourceType));
    for (const member of members) {
      candidates.push(await buildCandidateFromMember(
        member,
        'FUZZY_DESC',
        `${sourceType} description resembles this member`,
        'low'
      ));
    }
  }

  const confidenceRank = { high: 0, medium: 1, low: 2 };
  const learnedFirst = (source) => (String(source || '').startsWith('LEARNED') ? 0 : 1);
  const sorted = dedupeCandidates(candidates)
    .sort((a, b) =>
      ((confidenceRank[a.confidence] ?? 9) - (confidenceRank[b.confidence] ?? 9))
      || (learnedFirst(a.source) - learnedFirst(b.source))
    );

  // One suggestion per member: the same person can match through several
  // signals (learned payer key, learned description key, fuzzy name), which
  // would otherwise show as repeated entries in the UI. Keep only the
  // highest-ranked suggestion for each member.
  const seenMembers = new Set();
  return sorted.filter((candidate) => {
    const memberId = String(candidate.member.id);
    if (seenMembers.has(memberId)) return false;
    seenMembers.add(memberId);
    return true;
  });
}

/**
 * Whether a payer name looks like the member's own name: some word of the
 * member's first name AND some word of their last name appear in it
 * ("MENGISTU Y ALEMAYEHU" resembles Mengistu Alemayehu). A differently
 * spelled registration fails, which errs on the side of not learning.
 */
function payerResemblesMember(payerName, member) {
  if (!payerName || !member) return false;
  const payerWords = new Set(normalizeWords(payerName).split(' ').filter((w) => w.length >= 2));
  const appears = (name) => normalizeWords(name).split(' ').some((w) => w.length >= 2 && payerWords.has(w));
  return appears(member.first_name) && appears(member.last_name);
}

/**
 * The payer name a transaction's keys are built from, for the resemblance
 * check (the same name getBankMatchKeys uses).
 */
function payerNameFor(transaction) {
  const sourceType = sourceTypeFor(transaction);
  return transaction?.payer_name
    || (sourceType === 'ACH' ? extractAchIndividualName(transaction?.description) : null)
    || (sourceType === 'ZELLE' ? normalizeDescriptionForKey(transaction?.description, sourceType) : null);
}

/**
 * Decide whether confirming THIS payment for memberId may teach the matcher
 * that the payer IS memberId.
 *
 * Crediting a payment to a member is a fact about one transaction. A learned
 * key is a standing claim about who a sender is, and it steers every future
 * payment from that sender. The two used to be the same write — so a friend
 * paying another member's pledge once silently re-pointed the friend's own
 * key at the other member. They are now separate:
 *
 *   remember: true   the treasurer said "remember this sender for this
 *                    member": create keys, and re-point keys held by someone
 *                    else.
 *   remember: false  "this payment only": write nothing.
 *   remember omitted automatic and bulk paths: create keys only when the
 *                    payer name resembles the member AND no key for this
 *                    payer belongs to anyone else. Never re-point a key.
 *
 * Returns { sender_link, reason, write, overwrite, prior_member_id }:
 *   sender_link  'REMEMBERED' (the sender is, or now is, known as this
 *                member) or 'THIS_PAYMENT_ONLY'
 *   reason       ALREADY_KNOWN | EXPLICIT | NAME_MATCHES_MEMBER |
 *                EXPLICIT_THIS_PAYMENT | SENDER_KNOWN_AS_OTHER |
 *                NAME_DOES_NOT_MATCH
 */
async function decideSenderLearning(transaction, memberId, { remember } = {}) {
  const keys = getBankMatchKeys(transaction);
  const existing = keys.length > 0
    ? await BankMemoMatch.findAll({ where: { match_key: keys.map((k) => k.matchKey) }, attributes: ['member_id'] })
    : [];
  const owners = existing.map((m) => String(m.member_id));

  // The legacy memo table is read as a learned signal too; a payer it holds
  // for someone else is just as much "known as another member".
  if (sourceTypeFor(transaction) === 'ZELLE') {
    const legacyMemo = normalizeLegacyMemo(transaction.description, 'ZELLE');
    if (legacyMemo) {
      const legacy = await ZelleMemoMatch.findOne({
        where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), legacyMemo.toLowerCase()),
        attributes: ['member_id']
      });
      if (legacy) owners.push(String(legacy.member_id));
    }
  }

  const other = owners.find((id) => id !== String(memberId));
  const known = owners.length > 0 && !other;
  const decision = (sender_link, reason, write, overwrite) => ({
    sender_link, reason, write, overwrite, prior_member_id: other || null
  });

  if (remember === true) return decision('REMEMBERED', known ? 'ALREADY_KNOWN' : 'EXPLICIT', true, true);
  if (known) {
    // Filling in a missing sibling key for a sender already known as this
    // member is not new knowledge — unless the treasurer said this payment only.
    return remember === false
      ? decision('REMEMBERED', 'ALREADY_KNOWN', false, false)
      : decision('REMEMBERED', 'ALREADY_KNOWN', true, false);
  }
  if (remember === false) return decision('THIS_PAYMENT_ONLY', 'EXPLICIT_THIS_PAYMENT', false, false);
  if (other) return decision('THIS_PAYMENT_ONLY', 'SENDER_KNOWN_AS_OTHER', false, false);

  const member = await Member.findByPk(memberId, { attributes: ['id', 'first_name', 'last_name'] });
  return payerResemblesMember(payerNameFor(transaction), member)
    ? decision('REMEMBERED', 'NAME_MATCHES_MEMBER', true, false)
    : decision('THIS_PAYMENT_ONLY', 'NAME_DOES_NOT_MATCH', false, false);
}

/**
 * Learn payer -> member keys from a confirmed payment, as far as
 * decideSenderLearning allows. Returns the decision plus the keys written.
 */
async function learnBankMemoMatch(transaction, memberId, { remember } = {}) {
  if (!transaction || !memberId) return { sender_link: null, reason: null, write: false, learned: [] };

  const decision = await decideSenderLearning(transaction, memberId, { remember });
  const learned = [];
  if (!decision.write) return { ...decision, learned };

  for (const key of getBankMatchKeys(transaction)) {
    const [match] = await BankMemoMatch.findOrCreate({
      where: { match_key: key.matchKey },
      defaults: {
        member_id: memberId,
        source_type: key.sourceType,
        raw_description: transaction.description || null,
        payer_name: transaction.payer_name || null,
        created_from_bank_transaction_id: transaction.id || null
      }
    });

    if (String(match.member_id) !== String(memberId)) {
      if (!decision.overwrite) continue;
      await match.update({
        member_id: memberId,
        raw_description: transaction.description || match.raw_description,
        payer_name: transaction.payer_name || match.payer_name,
        created_from_bank_transaction_id: transaction.id || match.created_from_bank_transaction_id
      });
    }
    learned.push(match);
  }

  return { ...decision, learned };
}

/**
 * Who each Zelle payer name is currently remembered as — the members its
 * learned payer key and legacy memo row point at (more than one means the
 * records disagree). One round trip per table for a whole page of names.
 * Returns Map(normalized payer name -> [{ id, first_name, last_name }]).
 */
async function findRememberedZelleSenders(payerNames) {
  const words = [...new Set((payerNames || []).map(normalizeWords).filter(Boolean))];
  const result = new Map(words.map((w) => [w, []]));
  if (words.length === 0) return result;

  const memberAttrs = ['id', 'first_name', 'last_name'];
  const add = (payer, member) => {
    const list = result.get(payer);
    if (list && member && !list.some((m) => String(m.id) === String(member.id))) {
      list.push({ id: member.id, first_name: member.first_name, last_name: member.last_name });
    }
  };

  const keys = await BankMemoMatch.findAll({
    where: { match_key: words.map((w) => `ZELLE:PAYER:${w}`) },
    include: [{ model: Member, as: 'member', attributes: memberAttrs }]
  });
  keys.forEach((k) => add(k.match_key.slice('ZELLE:PAYER:'.length), k.member));

  const legacy = await ZelleMemoMatch.findAll({
    where: sequelize.where(sequelize.fn('upper', sequelize.col('memo')), { [Op.in]: words }),
    include: [{ model: Member, as: 'member', attributes: memberAttrs }]
  });
  legacy.forEach((row) => add(normalizeWords(row.memo), row.member));
  return result;
}

/**
 * Write the legacy zelle_memo_matches row for a payer, obeying a decision
 * from decideSenderLearning: created only when writing is allowed, re-pointed
 * at another member only when overwriting is.
 */
async function learnLegacyZelleMemo(memo, memberId, decision, names = {}) {
  if (!decision?.write || !memo || memo.length < 3) return;
  const existing = await ZelleMemoMatch.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), memo.toLowerCase())
  });
  if (!existing) {
    await ZelleMemoMatch.create({ member_id: memberId, memo, ...names });
  } else if (String(existing.member_id) !== String(memberId) && decision.overwrite) {
    await existing.update({ member_id: memberId, ...names });
  }
}

module.exports = {
  decideSenderLearning,
  extractAchIndividualName,
  findRememberedZelleSenders,
  findSuggestionCandidates,
  getBankMatchKeys,
  learnBankMemoMatch,
  learnLegacyZelleMemo,
  payerResemblesMember,
  normalizeDescriptionForKey,
  normalizeWords,
  sourceTypeFor
};
