const { google } = require('googleapis');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { Member, Transaction, sequelize, ZelleMemoMatch, IncomeCategory } = require('../models');
const tz = require('../config/timezone');

const LABEL_PROCESSED = 'Zelle/Processed';
const LABEL_NEEDS_REVIEW = 'Zelle/NeedsReview';

function getOAuth2Client() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error('Missing Gmail OAuth env vars (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
  }
  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    'http://127.0.0.1' // not used for refresh
  );
  oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return oAuth2Client;
}

async function ensureLabel(gmail, userId, name) {
  const { data } = await gmail.users.labels.list({ userId });
  const found = (data.labels || []).find(l => l.name === name);
  if (found) return found.id;
  const res = await gmail.users.labels.create({ userId, requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' } });
  return res.data.id;
}

// Sanitize boilerplate phrases commonly present in Zelle emails from Chase
function sanitizeNote(input) {
  if (!input) return input;
  let out = String(input);
  // Remove leading "You received money with Zelle®"
  out = out.replace(/You received money with Zelle(?:®)?/gi, '');
  // Remove optional separator + "Memo N/A"
  out = out.replace(/(\s*\|\s*)?Memo N\/A/gi, '');
  // Remove trailing "is registered with a Zelle®"
  out = out.replace(/\s*is registered with a Zelle(?:®)?/gi, '');
  // Collapse multiple spaces and separators, trim
  out = out.replace(/\s{2,}/g, ' ').replace(/\s*\|\s*/g, ' ').trim();
  return out;
}

function parseCandidatesFromMessage(msg) {
  // Extract headers
  const headers = msg.payload?.headers || [];
  const getHeader = (n) => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
  const subject = getHeader('Subject') || '';
  const from = getHeader('From') || '';
  const dateHeader = getHeader('Date') || '';
  const messageId = getHeader('Message-Id') || msg.id;
  const internalDate = msg.internalDate ? Number(msg.internalDate) : undefined;

  // Pull text snippet for quick regex; for HTML body, walk parts
  let bodyText = msg.snippet || '';
  function extractParts(parts) {
    if (!parts) return;
    for (const p of parts) {
      if (p.mimeType === 'text/plain' && p.body?.data) {
        try { bodyText += '\n' + Buffer.from(p.body.data, 'base64').toString('utf8'); } catch (_) {}
      }
      if (p.parts) extractParts(p.parts);
    }
  }
  extractParts(msg.payload?.parts);

  // Amount like $123.45
  const amountMatch = bodyText.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/);
  const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : null;

  // Phone in memo, e.g., 10-11 digits with optional separators
  const phoneMatch = bodyText.replace(/\D/g, '').match(/(1?\d{10})/);
  const phoneE164 = phoneMatch ? (phoneMatch[1].length === 11 ? '+' + phoneMatch[1] : '+1' + phoneMatch[1]) : null;

  // Sender email
  const emailMatch = from.match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : (from.includes('@') ? from.toLowerCase() : null);

  // Memo heuristics
  let note = subject;
  if (bodyText) {
    const memoIdx = bodyText.toLowerCase().indexOf('memo');
    note += memoIdx >= 0 ? ` | ${bodyText.substring(memoIdx, memoIdx + 160)}` : '';
  }
  note = sanitizeNote(note);

  // Date - ensure timezone is CST
  const dt = internalDate ? moment(internalDate).tz(tz.TIMEZONE) : (dateHeader ? moment(new Date(dateHeader)).tz(tz.TIMEZONE) : moment().tz(tz.TIMEZONE));
  const payment_date = dt.isValid() ? dt.format('YYYY-MM-DD') : moment().tz(tz.TIMEZONE).format('YYYY-MM-DD');

  return { amount, phoneE164, senderEmail, messageId, note, payment_date, subject, bodyText };
}

async function findCollectorMemberId() {
  // Prefer an admin member as collector; else fallback to first member id
  const admin = await Member.findOne({ where: { role: 'admin' }, order: [['id', 'ASC']] });
  if (admin) return admin.id;
  const any = await Member.findOne({ order: [['id', 'ASC']] });
  if (any) return any.id;
  throw new Error('No member found to set as collected_by');
}

// Do not use sender email or memo phone for matching (per requirements)
async function findMemberId(_parsed) {
  return null;
}

// Memo-based matching: use note text only (name tokens), do NOT use phone from memo
async function findMemberByMemo(note) {
  if (!note) return { id: null, name: null, candidates: [] };

  const raw = String(note || '').toLowerCase();

  // Name tokens (letters only, collapse spaces)
  const nameTokens = raw
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8); // limit tokens considered

  let candidates = [];

  // Then try name token matching (AND of tokens across first/middle/last)
  if (nameTokens.length > 0) {
    const tokenClauses = nameTokens.map(t => ({
      [Op.or]: [
        { first_name: { [Op.iLike]: `%${t}%` } },
        { middle_name: { [Op.iLike]: `%${t}%` } },
        { last_name: { [Op.iLike]: `%${t}%` } },
      ]
    }));

    const byName = await Member.findAll({
      where: { [Op.and]: tokenClauses },
      attributes: ['id', 'first_name', 'last_name']
    });
    candidates.push(...byName.map(m => ({ id: m.id, name: `${m.first_name || ''} ${m.last_name || ''}`.trim() })));
  }

  // Deduplicate candidates by id
  const seen = new Set();
  candidates = candidates.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  if (candidates.length === 1) {
    return { id: candidates[0].id, name: candidates[0].name, candidates };
  }
  return { id: null, name: null, candidates };
}

// Exact memo match using zelle_memo_matches (case-insensitive match on sanitized memo)
async function findMemberByExactMemo(note) {
  const cleaned = sanitizeNote(note || '');
  if (!cleaned) return { id: null, name: null, candidates: [] };
  const memoLower = cleaned.toLowerCase();
  // Match case-insensitively by comparing lower(memo) = memoLower
  const match = await ZelleMemoMatch.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), memoLower)
  });
  if (!match) return { id: null, name: null, candidates: [] };

  // Load member name for display
  const member = await Member.findByPk(match.member_id, { attributes: ['id', 'first_name', 'last_name'] });
  if (!member) return { id: null, name: null, candidates: [] };
  return {
    id: member.id,
    name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
    candidates: []
  };
}

async function upsertTransaction(parsed, { dryRun = false } = {}) {
  const { amount, messageId, note, payment_date } = parsed;
  if (!amount || !messageId) return { created: false, reason: 'missing_amount_or_message_id' };

  const member_id = await findMemberId(parsed);
  if (!member_id) return { created: false, reason: 'no_member_match' };

  const collected_by = await findCollectorMemberId();

  if (dryRun) return { created: true, dryRun: true, member_id, collected_by };

  // Insert-only behavior: if exists, do not modify
  const existing = await Transaction.findOne({ where: { external_id: `gmail:${messageId}` } });
  if (existing) {
    return { created: false, reason: 'exists', transactionId: existing.id };
  }

  // Auto-assign income category for 'donation' payment type
  let income_category_id = null;
  const incomeCategory = await IncomeCategory.findOne({
    where: { payment_type_mapping: 'donation' }
  });
  if (incomeCategory) {
    income_category_id = incomeCategory.id;
  }

  const tx = await Transaction.create({
    member_id,
    collected_by,
    payment_date,
    amount,
    payment_type: 'donation',
    payment_method: 'zelle',
    status: 'succeeded',
    receipt_number: null,
    note,
    external_id: `gmail:${messageId}`,
    donation_id: null,
    income_category_id
  });
  return { created: true, transactionId: tx.id };
}

async function syncZelleFromGmail({ dryRun = false } = {}) {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';

  // Prepare labels
  // Labels require gmail.modify. If token only has gmail.readonly, these will fail.
  // Treat labels as optional.
  let processedLabelId = null;
  let needsReviewLabelId = null;
  try { processedLabelId = await ensureLabel(gmail, userId, LABEL_PROCESSED); } catch (_) {}
  try { needsReviewLabelId = await ensureLabel(gmail, userId, LABEL_NEEDS_REVIEW); } catch (_) {}

  const qParts = [
    '(subject:"zelle" OR subject:"payment received" OR subject:"you received")',
    'newer_than:30d',
  ];
  // Exclude processed label if available
  if (processedLabelId) qParts.push(`-label:"${LABEL_PROCESSED}"`);
  const q = qParts.join(' ');

  const list = await gmail.users.messages.list({ userId, q, maxResults: 25 });
  const messages = list.data.messages || [];

  let stats = { scanned: 0, created: 0, updated: 0, needsReview: 0, skipped: 0, errors: 0 };

  for (const m of messages) {
    try {
      const full = await gmail.users.messages.get({ userId, id: m.id, format: 'full' });
      const parsed = parseCandidatesFromMessage(full.data);
      parsed.gmailId = m.id;

      // Try upsert
      const res = await upsertTransaction(parsed, { dryRun });
      if (res.created || res.dryRun) {
        // Mark processed
        if (processedLabelId) {
          try { await gmail.users.messages.modify({ userId, id: m.id, requestBody: { addLabelIds: [processedLabelId] } }); } catch (_) {}
        }
        stats.created += res.created ? 1 : 0;
        stats.scanned += 1;
      } else if (res.reason === 'no_member_match') {
        if (needsReviewLabelId) {
          try { await gmail.users.messages.modify({ userId, id: m.id, requestBody: { addLabelIds: [needsReviewLabelId] } }); } catch (_) {}
        }
        stats.needsReview += 1;
        stats.scanned += 1;
      } else {
        stats.skipped += 1;
        stats.scanned += 1;
      }
    } catch (e) {
      // Label needs review on any failure
      if (needsReviewLabelId) {
        try { await gmail.users.messages.modify({ userId, id: m.id, requestBody: { addLabelIds: [needsReviewLabelId] } }); } catch (_) {}
      }
      stats.errors += 1;
    }
  }

  return stats;
}

module.exports = { syncZelleFromGmail };
// Preview parser: return parsed candidates only (no DB writes, no labels)
async function previewZelleFromGmail({ limit = 5 } = {}) {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';

  const qParts = [
    '(subject:"zelle" OR subject:"payment received" OR subject:"you received")',
    'newer_than:30d',
  ];
  const q = qParts.join(' ');

  const list = await gmail.users.messages.list({ userId, q, maxResults: Math.min(limit, 25) });
  const messages = list.data.messages || [];
  const results = [];

  for (const m of messages) {
    try {
      const full = await gmail.users.messages.get({ userId, id: m.id, format: 'full' });
      const parsed = parseCandidatesFromMessage(full.data);
      // Ignore PayPal sender
      if (parsed.senderEmail && parsed.senderEmail.trim().toLowerCase() === 'service@paypal.com') {
        continue;
      }
      // Do not use sender email or memo phone; first try exact memo match, then token-based
      let memoMatch = await findMemberByExactMemo(parsed.note);
      if (!memoMatch.id) {
        memoMatch = await findMemberByMemo(parsed.note);
      }
      const member_id = memoMatch.id;
      const external_id = parsed.messageId ? `gmail:${parsed.messageId}` : null;
      // Check if a transaction with this external_id already exists
      let already_exists = false;
      let existing_transaction_id = null;
      let payment_type = 'donation';
      if (external_id) {
        const existing = await Transaction.findOne({ where: { external_id } });
        if (existing) {
          already_exists = true;
          existing_transaction_id = existing.id;
          if (existing.payment_type) {
            payment_type = existing.payment_type;
          }
        }
      }
      const would_create = !!(parsed.amount && external_id && member_id) && !already_exists;
      results.push({
        gmail_id: m.id,
        external_id,
        amount: parsed.amount,
        payment_date: parsed.payment_date,
        sender_email: parsed.senderEmail,
        memo_phone_e164: parsed.phoneE164,
        note_preview: sanitizeNote(parsed.note),
        subject: parsed.subject,
        matched_member_id: member_id,
        matched_member_name: memoMatch.name || null,
        matched_candidates: memoMatch.candidates || [],
        would_create,
        already_exists,
        existing_transaction_id,
        payment_method: 'zelle',
        payment_type,
        status: 'succeeded'
      });
    } catch (e) {
      results.push({ gmail_id: m.id, error: e.message || String(e) });
    }
  }

  return { count: results.length, items: results };
}

module.exports.previewZelleFromGmail = previewZelleFromGmail;
