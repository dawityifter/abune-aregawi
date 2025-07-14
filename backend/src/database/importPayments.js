require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { sequelize, MemberPayment } = require('../models');

const importPayments = async () => {
  try {
    console.log('🔄 Starting payment data import...');
    
    // Clear existing data
    await MemberPayment.destroy({ where: {} });
    console.log('✅ Cleared existing payment data');
    
    const results = [];
    const csvPath = '../Member-full-list-2024-dawit-cleaned.csv';
    
    // Read CSV file
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`📊 Found ${results.length} payment records`);
        
        // Debug: print first few rows
        console.log('First 3 rows keys:', Object.keys(results[0]));
        console.log('First row values:', results[0]);
        
        // Clean monetary values function
        const cleanMonetaryValue = (value) => {
          if (!value || value === '') return 0;
          return parseFloat(value.toString().replace(/[$,]/g, '')) || 0;
        };
        
        // Process and insert data
        let skipped = 0;
        const paymentRecords = results
          .map((row, index) => {
            const memberName = (row['Member Name'] || '').trim();
            if (!memberName) {
              skipped++;
              console.log(`Skipping row ${index + 1}:`, row);
              return null;
            }
            
            const record = {
              memberName: memberName,
              spouseName: (row['Spouse Name'] || '').trim(),
              phone1: (row['Phone '] || '').trim(),
              phone2: (row['Spouse Phone'] || '').trim(),
              year: 2024,
              paymentMethod: (row['Paymt Method'] || 'Cash').trim(),
              monthlyPayment: cleanMonetaryValue(row['Monthly Payment']),
              totalAmountDue: cleanMonetaryValue(row['Total Amount Due']),
              january: cleanMonetaryValue(row['Jan']),
              february: cleanMonetaryValue(row['Feb']),
              march: cleanMonetaryValue(row['March']),
              april: cleanMonetaryValue(row['April']),
              may: cleanMonetaryValue(row['May']),
              june: cleanMonetaryValue(row['June']),
              july: cleanMonetaryValue(row['July']),
              august: cleanMonetaryValue(row['August']),
              september: cleanMonetaryValue(row['Sept']),
              october: cleanMonetaryValue(row['Oct']),
              november: cleanMonetaryValue(row['Nov']),
              december: cleanMonetaryValue(row['Dec']),
              totalCollected: cleanMonetaryValue(row['Total Collected amount']),
              balanceDue: cleanMonetaryValue(row['Bal Due/Difference']),
              paidUpToDate: (row['Paid up-to/Date'] || '').trim(),
              numberOfHousehold: parseInt(row['Number of Household'] || '0') || 0
            };
            
            // Debug: print the first record structure
            if (index === 0) {
              console.log('First record structure:', record);
            }
            
            return record;
          })
          .filter(record => record !== null);
        
        console.log(`✅ Prepared ${paymentRecords.length} valid payment records for import`);
        console.log(`⏭️ Skipped ${skipped} rows due to missing member_name`);
        
        if (paymentRecords.length === 0) {
          console.log('❌ No valid records to import');
          return;
        }
        
        // Insert records
        await MemberPayment.bulkCreate(paymentRecords);
        console.log(`✅ Successfully imported ${paymentRecords.length} payment records`);
        
        // Verify import
        const count = await MemberPayment.count();
        console.log(`📊 Total payment records in database: ${count}`);
        
        await sequelize.close();
        console.log('✅ Import completed successfully');
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV file:', error);
      });
      
  } catch (error) {
    console.error('❌ Import failed:', error);
    await sequelize.close();
  }
};

importPayments(); 