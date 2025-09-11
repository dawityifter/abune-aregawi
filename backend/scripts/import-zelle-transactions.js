const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transaction, Member, sequelize } = require('../src/models');

// Configuration
const CSV_FILE_PATH = path.join(__dirname, '../../Combined_Zelle_Payments_with_Phone_and_Names.csv');
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const YEAR = 2025; // All dates are in 2025

// Statistics
let processed = 0;
let inserted = 0;
let skipped = 0;
let unmatchedPhones = new Set();

// Helper function to parse date from MM/dd to YYYY-MM-dd
function parseDate(dateStr) {
  const [month, day] = dateStr.split('/');
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);

  if (isNaN(monthNum) || isNaN(dayNum) || monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  return `${YEAR}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

// Helper function to normalize phone number for lookup
function normalizePhone(phone) {
  if (!phone) return null;

  // Remove + and spaces, keep only digits
  const cleaned = phone.replace(/[^\d]/g, '');

  // If it starts with 1, remove it
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned;
  }

  // Add +1 if not present and it's 10 digits
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }

  // Add + if not present
  if (!cleaned.startsWith('+')) {
    return '+' + cleaned;
  }

  return phone;
}

async function processTransaction(row) {
  processed++;

  const {
    Month,
    Date: dateStr,
    Sender,
    Code,
    Amount,
    'Matched Name': matchedName,
    Phone,
    'First Name': firstName,
    'Middle Name': middleName,
    'Last Name': lastName
  } = row;

  try {
    // Parse date
    const paymentDate = parseDate(dateStr);

    // Parse amount
    const amount = parseFloat(Amount);
    if (isNaN(amount) || amount <= 0) {
      console.log(`⚠️  Skipping row ${processed}: Invalid amount ${Amount}`);
      skipped++;
      return;
    }

    // Prepare transaction data
    const transactionData = {
      external_id: Code,
      amount,
      payment_date: paymentDate,
      payment_type: 'membership_due', // Default to membership due
      payment_method: 'zelle',
      status: 'succeeded',
      note: `Imported from Zelle: ${Sender}`,
      collected_by: 3, // Use Dawit Yifter's ID from the database
    };

    // Look up member by phone if available
    let memberId = null;
    if (Phone) {
      const normalizedPhone = normalizePhone(Phone);
      const member = await Member.findOne({
        where: { phone_number: normalizedPhone }
      });

      if (member) {
        memberId = member.id;
        transactionData.member_id = memberId;
      } else {
        unmatchedPhones.add(Phone);
        console.log(`⚠️  Unmatched phone: ${Phone} for sender: ${Sender}`);
      }
    } else {
      console.log(`ℹ️  No phone provided for sender: ${Sender}`);
    }

    // Log what would be inserted
    if (DRY_RUN) {
      console.log(`🔍 [DRY RUN] Would insert transaction:`);
      console.log(`   - External ID: ${Code}`);
      console.log(`   - Amount: $${amount}`);
      console.log(`   - Date: ${paymentDate}`);
      console.log(`   - Member ID: ${memberId || 'Not found'}`);
      console.log(`   - Sender: ${Sender}`);
      console.log(`   - Phone: ${Phone || 'Not provided'}`);
      console.log(`   - Matched Name: ${matchedName || 'N/A'}`);
      console.log(`   ---`);
    } else {
      // Check if transaction already exists
      const existing = await Transaction.findOne({
        where: { external_id: Code }
      });

      if (existing) {
        console.log(`⚠️  Skipping: Transaction with external_id ${Code} already exists`);
        skipped++;
        return;
      }

      // Create transaction
      if (memberId) {
        await Transaction.create(transactionData);
        inserted++;
        console.log(`✅ Inserted transaction for ${Sender}: $${amount}`);
      } else {
        console.log(`⚠️  Skipping transaction for ${Sender}: No matching member found`);
        skipped++;
      }
    }

  } catch (error) {
    console.error(`❌ Error processing row ${processed}:`, error.message);
    skipped++;
  }
}

async function main() {
  console.log(`🚀 Starting Zelle transaction import${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`📁 CSV File: ${CSV_FILE_PATH}`);
  console.log(`📅 Year: ${YEAR}`);
  console.log(`---`);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  // Process CSV file
  const stream = fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', async (row) => {
      // Pause stream while processing
      stream.pause();
      await processTransaction(row);
      stream.resume();
    })
    .on('end', async () => {
      console.log(`\n📊 Import Summary:`);
      console.log(`   - Processed: ${processed}`);
      console.log(`   - Inserted: ${inserted}`);
      console.log(`   - Skipped: ${skipped}`);

      if (unmatchedPhones.size > 0) {
        console.log(`\n📞 Unmatched Phones (${unmatchedPhones.size}):`);
        unmatchedPhones.forEach(phone => console.log(`   - ${phone}`));
      }

      console.log(`\n✅ Import ${DRY_RUN ? 'dry run' : 'completed'} successfully!`);

      await sequelize.close();
      process.exit(0);
    })
    .on('error', (error) => {
      console.error('❌ Error reading CSV:', error);
      process.exit(1);
    });
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, parseDate, normalizePhone };
