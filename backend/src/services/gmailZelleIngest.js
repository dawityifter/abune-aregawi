const { google } = require('googleapis');
const moment = require('moment-timezone');
const { Member, Transaction, ZelleEmailQueue } = require('../models');
const {
  sanitizeNote,
  extractPayerName,
  matchZelleSender,
  getDefaultPaymentType,
  createZelleTransaction
} = require('./zelleTransactionService');
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
        try { bodyText += '\n' + Buffer.from(p.body.data, 'base64').toString('utf8'); } catch (_) { }
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

  // Payer (sender) name — parsed as its own field so matching/learning is
  // stable across different amounts and memo texts
  const payerName = extractPayerName(`${subject}\n${bodyText}`);

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

  return { amount, phoneE164, senderEmail, messageId, note, payment_date, subject, bodyText, payerName };
}

function isIgnoredSender(parsed) {
  const sender = (parsed.senderEmail || '').trim().toLowerCase();
  return sender === 'service@paypal.com';
}

async function findCollectorMemberId() {
  // Prefer an admin member as collector; else fallback to first member id
  const admin = await Member.findOne({ where: { role: 'admin' }, order: [['id', 'ASC']] });
  if (admin) return admin.id;
  const any = await Member.findOne({ order: [['id', 'ASC']] });
  if (any) return any.id;
  throw new Error('No member found to set as collected_by');
}

async function upsertQueueRow(parsed, fields) {
  const external_id = `gmail:${parsed.messageId}`;
  const [row] = await ZelleEmailQueue.findOrCreate({
    where: { external_id },
    defaults: {
      gmail_id: parsed.gmailId || null,
      external_id,
      payer_name: parsed.payerName || null,
      amount: parsed.amount || null,
      payment_date: parsed.payment_date || null,
      subject: parsed.subject || null,
      note: parsed.note || null,
      ...fields
    }
  });
  // Refresh parse fields + status on existing rows (unless already finalized)
  const finalized = ['CREATED', 'AUTO_CREATED', 'IGNORED'];
  if (!finalized.includes(row.status)) {
    await row.update({
      gmail_id: parsed.gmailId || row.gmail_id,
      payer_name: parsed.payerName || row.payer_name,
      amount: parsed.amount || row.amount,
      payment_date: parsed.payment_date || row.payment_date,
      subject: parsed.subject || row.subject,
      note: parsed.note || row.note,
      ...fields
    });
  }
  return row;
}

/**
 * Automated sync:
 * - Persists every Zelle email into zelle_email_queue
 * - Auto-creates Transaction + LedgerEntry when the payer was previously
 *   associated with a member (learned match, high confidence)
 * - Everything else is queued as NEEDS_REVIEW for the treasurer
 */
async function syncZelleFromGmail({ dryRun = false } = {}) {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });
  const userId = 'me';

  // Labels require gmail.modify. If token only has gmail.readonly, treat as optional.
  let processedLabelId = null;
  let needsReviewLabelId = null;
  try { processedLabelId = await ensureLabel(gmail, userId, LABEL_PROCESSED); } catch (_) { }
  try { needsReviewLabelId = await ensureLabel(gmail, userId, LABEL_NEEDS_REVIEW); } catch (_) { }

  const qParts = [
    '(subject:"zelle" OR subject:"payment received" OR subject:"you received")',
    'newer_than:30d',
  ];
  if (processedLabelId) qParts.push(`-label:"${LABEL_PROCESSED}"`);
  const q = qParts.join(' ');

  const list = await gmail.users.messages.list({ userId, q, maxResults: 50 });
  const messages = list.data.messages || [];

  const stats = { scanned: 0, autoCreated: 0, needsReview: 0, skipped: 0, errors: 0 };
  const addLabel = async (id, labelId) => {
    if (!labelId || dryRun) return;
    try { await gmail.users.messages.modify({ userId, id, requestBody: { addLabelIds: [labelId] } }); } catch (_) { }
  };

  let collectorId = null;

  for (const m of messages) {
    try {
      stats.scanned += 1;
      const full = await gmail.users.messages.get({ userId, id: m.id, format: 'full' });
      const parsed = parseCandidatesFromMessage(full.data);
      parsed.gmailId = m.id;

      if (isIgnoredSender(parsed)) {
        stats.skipped += 1;
        await addLabel(m.id, processedLabelId);
        continue;
      }

      const external_id = `gmail:${parsed.messageId}`;

      // Already in queue and finalized? Just make sure the label is set.
      const queued = await ZelleEmailQueue.findOne({ where: { external_id } });
      if (queued && ['CREATED', 'AUTO_CREATED', 'IGNORED'].includes(queued.status)) {
        stats.skipped += 1;
        await addLabel(m.id, processedLabelId);
        continue;
      }

      // Transaction already exists (e.g. created before the queue existed)?
      const existingTx = await Transaction.findOne({ where: { external_id } });
      if (existingTx) {
        if (!dryRun) {
          await upsertQueueRow(parsed, {
            status: 'CREATED',
            transaction_id: existingTx.id,
            matched_member_id: existingTx.member_id || null,
            processed_at: new Date()
          });
        }
        stats.skipped += 1;
        await addLabel(m.id, processedLabelId);
        continue;
      }

      // Match sender to member
      const match = await matchZelleSender({ payerName: parsed.payerName, note: parsed.note });

      const canAutoCreate = match.confidence === 'high' && match.member_id && parsed.amount;
      if (canAutoCreate) {
        if (dryRun) {
          stats.autoCreated += 1;
          continue;
        }
        collectorId = collectorId || await findCollectorMemberId();
        const { payment_type, for_year } = await getDefaultPaymentType(match.member_id, parsed.payment_date);
        const result = await createZelleTransaction({
          external_id,
          amount: parsed.amount,
          payment_date: parsed.payment_date,
          note: parsed.note,
          member_id: match.member_id,
          payment_type,
          for_year,
          receipt_number: null,
          payer_name: parsed.payerName
        }, collectorId);

        await upsertQueueRow(parsed, {
          status: 'AUTO_CREATED',
          transaction_id: result.id || null,
          matched_member_id: match.member_id,
          match_confidence: match.confidence,
          match_source: match.source,
          processed_at: new Date(),
          error: null
        });
        stats.autoCreated += 1;
        await addLabel(m.id, processedLabelId);
      } else {
        if (!dryRun) {
          await upsertQueueRow(parsed, {
            status: 'NEEDS_REVIEW',
            matched_member_id: match.member_id || null,
            match_confidence: match.confidence,
            match_source: match.source,
            error: null
          });
        }
        stats.needsReview += 1;
        await addLabel(m.id, needsReviewLabelId);
      }
    } catch (e) {
      stats.errors += 1;
      console.error('Zelle sync error for message', m.id, e.message || e);
      try {
        if (!dryRun) {
          await ZelleEmailQueue.update(
            { status: 'ERROR', error: String(e.message || e) },
            { where: { gmail_id: m.id, status: { [require('sequelize').Op.notIn]: ['CREATED', 'AUTO_CREATED', 'IGNORED'] } } }
          );
        }
      } catch (_) { }
      await addLabel(m.id, needsReviewLabelId);
    }
  }

  return stats;
}

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

  const list = await gmail.users.messages.list({ userId, q, maxResults: Math.min(limit, 50) });
  const messages = list.data.messages || [];
  const results = [];

  for (const m of messages) {
    try {
      const full = await gmail.users.messages.get({ userId, id: m.id, format: 'full' });
      const parsed = parseCandidatesFromMessage(full.data);
      if (isIgnoredSender(parsed)) {
        continue;
      }

      // Unified matching: learned payer keys -> legacy memo -> fuzzy
      const match = await matchZelleSender({ payerName: parsed.payerName, note: parsed.note });
      const member_id = match.member_id;
      const external_id = parsed.messageId ? `gmail:${parsed.messageId}` : null;

      // Check if a transaction with this external_id already exists
      let already_exists = false;
      let existing_transaction_id = null;
      let payment_type = 'donation';
      let existing_receipt_number = null;
      let existing_note = null;
      if (external_id) {
        const existing = await Transaction.findOne({ where: { external_id } });
        if (existing) {
          already_exists = true;
          existing_transaction_id = existing.id;
          if (existing.payment_type) {
            payment_type = existing.payment_type;
          }
          existing_receipt_number = existing.receipt_number;
          existing_note = existing.note;
        }
      }

      // Queue status (AUTO_CREATED etc.) for visibility in the review screen
      let queue_status = null;
      if (external_id) {
        const queued = await ZelleEmailQueue.findOne({ where: { external_id }, attributes: ['status'] });
        queue_status = queued?.status || null;
      }

      const would_create = !!(parsed.amount && external_id && member_id) && !already_exists;
      results.push({
        gmail_id: m.id,
        external_id,
        amount: parsed.amount,
        payment_date: parsed.payment_date,
        sender_email: parsed.senderEmail,
        memo_phone_e164: parsed.phoneE164,
        payer_name: parsed.payerName,
        note_preview: sanitizeNote(parsed.note),
        subject: parsed.subject,
        matched_member_id: member_id,
        matched_member_name: match.member_name || null,
        match_confidence: match.confidence,
        match_source: match.source,
        matched_candidates: (match.candidates || []).map(c => ({ id: c.id, name: c.name })),
        would_create,
        already_exists,
        existing_transaction_id,
        existing_note: existing_note || null,
        existing_receipt_number,
        queue_status,
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

module.exports = { syncZelleFromGmail, previewZelleFromGmail };
