'use strict';
require('dotenv').config();

const { sequelize, Member, Dependent } = require('../models');
const { Op } = require('sequelize');

const BATCH_SIZE = 500;

function normalizePhoneE164(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('+')) {
    // Remove spaces/dashes/paren after '+'
    const digits = '+' + s.replace(/[^\d]/g, '').replace(/^\+/, '');
    return digits;
  }
  // Strip all non-digits
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  // Fallback: if it looks like E.164 missing '+', add it
  if (digitsOnly.length > 0) {
    return `+${digitsOnly}`;
  }
  return null;
}

async function findUniqueMemberMatchForDependent(dep) {
  // Prefer phone match, then email match; require uniqueness
  // Note: Member uses phone_number; Dependent uses phone
  const phone = normalizePhoneE164(dep.phone);
  const email = dep.email ? dep.email.trim().toLowerCase() : null;

  // 1) Phone match
  if (phone) {
    // Try direct match first
    let phoneMatches = await Member.findAll({
      where: { phone_number: phone, is_active: true },
      attributes: ['id', 'phone_number', 'email']
    });
    if (phoneMatches.length !== 1) {
      // If not unique, attempt to match normalized variants against stored values
      // Normalize member.phone_number on the fly in JS after fetching candidates by digits suffix
      const last7 = phone.slice(-7);
      const candidates = await Member.findAll({
        where: {
          is_active: true,
          phone_number: { [Op.iLike]: `%${last7}` }
        },
        attributes: ['id', 'phone_number', 'email']
      });
      phoneMatches = candidates.filter(m => normalizePhoneE164(m.phone_number) === phone);
    }
    if (phoneMatches.length === 1) return phoneMatches[0];
    if (phoneMatches.length > 1) return { ambiguous: true, by: 'phone', count: phoneMatches.length };
  }

  // 2) Email match
  if (email) {
    const emailMatches = await Member.findAll({
      where: {
        email: email,
        is_active: true
      },
      attributes: ['id', 'phone_number', 'email']
    });
    if (emailMatches.length === 1) return emailMatches[0];
    if (emailMatches.length > 1) return { ambiguous: true, by: 'email', count: emailMatches.length };
  }

  return null;
}

async function run({ dryRun = true } = {}) {
  console.log(`\n=== Backfill linked_member_id (dryRun=${dryRun}) ===`);

  await sequelize.authenticate();
  console.log('✅ DB connected');

  let offset = 0;
  let processed = 0;
  let linked = 0;
  let skippedNoMatch = 0;
  let skippedAlreadySet = 0;
  let skippedAmbiguous = 0;

  while (true) {
    const deps = await Dependent.findAll({
      where: {
        [Op.or]: [
          { linkedMemberId: { [Op.is]: null } },
          { linkedMemberId: { [Op.eq]: undefined } }
        ]
      },
      attributes: ['id', 'memberId', 'firstName', 'lastName', 'dateOfBirth', 'phone', 'email', 'linkedMemberId'],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
      offset
    });

    if (!deps.length) break;

    // Start a transaction per batch to minimize lock time
    const tx = await sequelize.transaction();
    try {
      for (const dep of deps) {
        processed++;

        if (dep.linkedMemberId) {
          skippedAlreadySet++;
          continue;
        }

        const match = await findUniqueMemberMatchForDependent(dep);

        if (!match) {
          skippedNoMatch++;
          continue;
        }

        if (match.ambiguous) {
          skippedAmbiguous++;
          console.log(`⚠️  Ambiguous match for dependent ${dep.id} by ${match.by} (count=${match.count})`);
          continue;
        }

        const memberId = match.id;
        console.log(`➡️  Link dependent ${dep.id} -> member ${memberId} (${dep.phone || dep.email || 'no-contact'})`);

        if (!dryRun) {
          await Dependent.update(
            { linkedMemberId: memberId },
            { where: { id: dep.id }, transaction: tx }
          );
          linked++;
        }
      }

      if (!dryRun) {
        await tx.commit();
      } else {
        await tx.rollback();
      }
    } catch (err) {
      await tx.rollback();
      console.error('❌ Error processing batch starting at offset', offset, err.message);
      // Proceed to next batch to keep going
    }

    offset += deps.length;
  }

  console.log('\n=== Backfill Summary ===');
  console.log('Processed:', processed);
  console.log('Linked:', linked, dryRun ? '(dry-run, not written)' : '');
  console.log('Skipped (already set):', skippedAlreadySet);
  console.log('Skipped (no match):', skippedNoMatch);
  console.log('Skipped (ambiguous):', skippedAmbiguous);

  await sequelize.close();
}

if (require.main === module) {
  const dryRun = process.argv.includes('--apply') ? false : true; // default to dry-run; use --apply to write
  run({ dryRun }).catch((e) => {
    console.error('❌ Backfill failed:', e.stack || e.message);
    process.exit(1);
  });
}

module.exports = { run };
