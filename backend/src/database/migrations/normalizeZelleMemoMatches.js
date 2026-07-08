/**
 * One-time migration: normalize legacy zelle_memo_matches and backfill
 * bank_memo_matches so both the Zelle email flow and the Bank Reconciliation
 * screen share the same learned payer -> member associations.
 *
 * For each zelle_memo_matches row:
 *  1. Clean the memo (strip "sent you $X.XX", amounts, Zelle boilerplate)
 *  2. Update the row's memo to the cleaned, amount-free version
 *  3. Upsert a bank_memo_matches row with key ZELLE:PAYER:<normalized name>
 *
 * Run with: node src/database/migrations/normalizeZelleMemoMatches.js
 */
const { sequelize, ZelleMemoMatch, BankMemoMatch } = require('../../models');
const { cleanLegacyMemo, extractPayerName } = require('../../services/zelleTransactionService');
const { normalizeWords } = require('../../services/bankMemoMatchService');

async function normalizeZelleMemoMatches() {
  console.log('🔧 Normalizing zelle_memo_matches and backfilling bank_memo_matches...');
  await sequelize.query('SET search_path TO public;').catch(() => { });

  const rows = await ZelleMemoMatch.findAll();
  console.log(`📋 Found ${rows.length} legacy memo matches`);

  const stats = { updatedMemos: 0, backfilled: 0, skipped: 0, conflicts: 0 };

  for (const row of rows) {
    try {
      // Prefer explicit payer extraction; fall back to cleaning the stored memo
      const payer = extractPayerName(row.memo) || null;
      const cleaned = cleanLegacyMemo(row.memo, payer);

      if (!cleaned || cleaned.length < 3) {
        stats.skipped += 1;
        continue;
      }

      // 1. Update legacy memo to amount-free version (dedupe-aware)
      if (cleaned.toLowerCase() !== String(row.memo || '').toLowerCase()) {
        const clash = await ZelleMemoMatch.findOne({
          where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), cleaned.toLowerCase())
        });
        if (!clash) {
          await row.update({ memo: cleaned });
          stats.updatedMemos += 1;
        } else if (String(clash.member_id) !== String(row.member_id)) {
          console.warn(`⚠️ Conflict: memo "${cleaned}" maps to members ${clash.member_id} and ${row.member_id}; keeping existing`);
          stats.conflicts += 1;
        }
      }

      // 2. Backfill bank_memo_matches with the stable payer key
      const matchKey = `ZELLE:PAYER:${normalizeWords(cleaned)}`;
      const [match, created] = await BankMemoMatch.findOrCreate({
        where: { match_key: matchKey },
        defaults: {
          member_id: row.member_id,
          source_type: 'ZELLE',
          raw_description: row.memo,
          payer_name: cleaned
        }
      });
      if (created) {
        stats.backfilled += 1;
      } else if (String(match.member_id) !== String(row.member_id)) {
        console.warn(`⚠️ Conflict: key "${matchKey}" already maps to member ${match.member_id} (legacy row says ${row.member_id}); keeping existing`);
        stats.conflicts += 1;
      }
    } catch (e) {
      console.error(`❌ Failed on zelle_memo_matches row ${row.id}:`, e.message);
    }
  }

  console.log('\n✅ Migration completed:');
  console.log(`   - Memos normalized: ${stats.updatedMemos}`);
  console.log(`   - bank_memo_matches backfilled: ${stats.backfilled}`);
  console.log(`   - Skipped (unusable memo): ${stats.skipped}`);
  console.log(`   - Conflicts (kept existing mapping): ${stats.conflicts}`);
  return stats;
}

if (require.main === module) {
  normalizeZelleMemoMatches()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = normalizeZelleMemoMatches;
