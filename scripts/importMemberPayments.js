const fs = require('fs');
const path = require('path');

// Load environment variables from backend directory
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const csv = require('csv-parser');
const { sequelize, MemberPayment } = require('../backend/src/models');

// Function to parse monetary values
function parseMonetaryValue(value) {
  if (!value || value.trim() === '') return null;
  
  // Remove dollar signs and commas
  const cleaned = value.replace(/[$,]/g, '');
  
  // Parse as float
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

// Function to parse integer values
function parseIntegerValue(value) {
  if (!value || value.trim() === '') return null;
  
  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

// Function to clean string values
function cleanStringValue(value) {
  if (!value || value.trim() === '') return null;
  return value.trim();
}

async function importMemberPayments() {
  try {
    console.log('🚀 Starting member payments import...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Sync the model to create the table
    await MemberPayment.sync({ force: false }); // Use force: true to recreate table
    console.log('✅ MemberPayment table synced');
    
    const csvFilePath = path.join(__dirname, '..', 'Member-full-list-2024-dawit-cleaned.csv');
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }
    
    console.log(`📁 Reading CSV file: ${csvFilePath}`);
    
    const results = [];
    
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          console.log(`📊 Read ${results.length} records from CSV`);
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
    
    console.log('🔄 Processing and importing data...');
    
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const row of results) {
      try {
        // Skip empty rows
        if (!row['Member Name'] || row['Member Name'].trim() === '') {
          skippedCount++;
          continue;
        }
        
        const paymentData = {
          memberName: cleanStringValue(row['Member Name']),
          spouseName: cleanStringValue(row['Partner Name']),
          phone1: cleanStringValue(row['Phone 1']),
          phone2: cleanStringValue(row['Phone 2']),
          year: parseIntegerValue(row['Date']),
          paymentMethod: cleanStringValue(row['Paymt Method']),
          monthlyPayment: parseMonetaryValue(row['Monthly Payment']),
          totalAmountDue: parseMonetaryValue(row['Total Amount Due']),
          january: parseMonetaryValue(row['Jan']),
          february: parseMonetaryValue(row['Feb']),
          march: parseMonetaryValue(row['March']),
          april: parseMonetaryValue(row['April']),
          may: parseMonetaryValue(row['May']),
          june: parseMonetaryValue(row['June']),
          july: parseMonetaryValue(row['July']),
          august: parseMonetaryValue(row['August']),
          september: parseMonetaryValue(row['Sept']),
          october: parseMonetaryValue(row['Oct']),
          november: parseMonetaryValue(row['Nov']),
          december: parseMonetaryValue(row['Dec']),
          totalCollected: parseMonetaryValue(row['Total Collected amount']),
          balanceDue: parseMonetaryValue(row['Bal Due/Difference']),
          paidUpToDate: cleanStringValue(row['Paid up-to/Date']),
          numberOfHousehold: parseIntegerValue(row['Number of Household'])
        };
        
        // Create the record
        await MemberPayment.create(paymentData);
        importedCount++;
        
        if (importedCount % 10 === 0) {
          console.log(`📈 Processed ${importedCount} records...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importing row for ${row['Member Name']}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   ✅ Imported: ${importedCount} records`);
    console.log(`   ⏭️  Skipped: ${skippedCount} records`);
    console.log(`   📁 Total processed: ${results.length} records`);
    
    // Show some sample data
    const sampleRecords = await MemberPayment.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']]
    });
    
    console.log('\n📋 Sample imported records:');
    sampleRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.memberName} - Monthly: $${record.monthlyPayment} - Total Due: $${record.totalAmountDue}`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the import
importMemberPayments(); 