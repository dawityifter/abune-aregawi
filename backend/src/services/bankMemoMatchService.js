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
  const candidates = [...await findLearnedCandidates(transaction)];
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
  return dedupeCandidates(candidates)
    .sort((a, b) => (confidenceRank[a.confidence] ?? 9) - (confidenceRank[b.confidence] ?? 9));
}

async function learnBankMemoMatch(transaction, memberId) {
  if (!transaction || !memberId) return [];

  const keys = getBankMatchKeys(transaction);
  const learned = [];
  for (const key of keys) {
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
      await match.update({
        member_id: memberId,
        raw_description: transaction.description || match.raw_description,
        payer_name: transaction.payer_name || match.payer_name,
        created_from_bank_transaction_id: transaction.id || match.created_from_bank_transaction_id
      });
    }
    learned.push(match);
  }

  return learned;
}

module.exports = {
  extractAchIndividualName,
  findSuggestionCandidates,
  getBankMatchKeys,
  learnBankMemoMatch,
  normalizeDescriptionForKey,
  normalizeWords,
  sourceTypeFor
};
