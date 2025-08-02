require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { sequelize, Member } = require('./src/models');

// Phone number normalization function
const normalizePhoneNumber = (value) => {
  if (!value) return '';
  
  // If already in E.164 format (starts with +), return as-is
  if (value.startsWith('+')) {
    return value;
  }
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Handle different input formats for regular numbers
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length > 11) {
    // International number
    return `+${digits}`;
  }
  
  // Invalid length
  return '';
};

const importMembers = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully.');

    const members = [];
    const errors = [];

    // Read CSV file
    console.log('📖 Reading CSV file...');
    fs.createReadStream('../church-members-list.csv')
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Parse and validate data
          const phoneNumber = row.phone_number ? normalizePhoneNumber(row.phone_number) : null;
          
          // Handle email - can be null for phone-only users
          const email = row.email || null;
          
          const memberData = {
            memberId: row.member_id || null,
            firstName: row.first_name || '',
            lastName: row.last_name || '',
            repentanceFather: row.repentance_father || null,
            baptismName: row.baptism_name || null,
            membershipStatus: row.membership_status || 'Existing',
            phoneNumber: phoneNumber,
            email: email,
            householdSize: parseInt(row.household_size) || 1,
            
            // Set default values for required fields
            gender: 'Male', // Default, will be updated later
            dateOfBirth: new Date('1990-01-01'), // Default, will be updated later
            maritalStatus: 'Single', // Default, will be updated later
            streetLine1: 'TBD', // Default, will be updated later
            city: 'TBD', // Default, will be updated later
            state: 'TX', // Default, will be updated later
            postalCode: '75000', // Default, will be updated later
            country: 'United States',
            role: 'member',
            isActive: true
          };

          // Validate required fields
          if (!memberData.firstName || !memberData.lastName) {
            errors.push(`Row ${row.member_id}: Missing first or last name`);
            return;
          }

          if (!memberData.phoneNumber) {
            console.log(`⚠️  Row ${row.member_id}: No phone number, skipping`);
            return;
          }

          members.push(memberData);
        } catch (error) {
          errors.push(`Row ${row.member_id}: ${error.message}`);
        }
      })
      .on('end', async () => {
        console.log(`📊 Processed ${members.length} members`);
        console.log(`❌ Found ${errors.length} errors`);

        if (errors.length > 0) {
          console.log('Errors:', errors);
        }

        // Import members to database
        console.log('💾 Importing members to database...');
        let imported = 0;
        let skipped = 0;

        for (const memberData of members) {
          try {
            // Check if member already exists by phone number
            const existingMember = await Member.findOne({
              where: { phoneNumber: memberData.phoneNumber }
            });

            if (existingMember) {
              console.log(`⏭️  Skipping ${memberData.firstName} ${memberData.lastName} - already exists`);
              skipped++;
              continue;
            }

            // Create new member
            await Member.create(memberData);
            console.log(`✅ Imported: ${memberData.firstName} ${memberData.lastName} (${memberData.phoneNumber})`);
            imported++;
          } catch (error) {
            console.error(`❌ Error importing ${memberData.firstName} ${memberData.lastName}:`, error.message);
            errors.push(`${memberData.firstName} ${memberData.lastName}: ${error.message}`);
          }
        }

        console.log('\n📋 Import Summary:');
        console.log(`   ✅ Successfully imported: ${imported}`);
        console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
        console.log(`   ❌ Errors: ${errors.length}`);

        if (errors.length > 0) {
          console.log('\n❌ Errors:');
          errors.forEach(error => console.log(`   - ${error}`));
        }

        await sequelize.close();
      });

  } catch (error) {
    console.error('❌ Import failed:', error);
    await sequelize.close();
  }
};

importMembers(); 