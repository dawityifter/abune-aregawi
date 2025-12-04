const { Sequelize, Member, Dependent, sequelize } = require('./src/models');
const bcrypt = require('bcryptjs');

// Usage: node promote-dependent.js <dependent_id> <optional_email> <optional_phone>
const dependentId = process.argv[2];
const email = process.argv[3];
const phone = process.argv[4];

if (!dependentId) {
    console.error('❌ Please provide a dependent ID');
    console.log('Usage: node promote-dependent.js <dependent_id> [email] [phone]');
    process.exit(1);
}

const promoteDependent = async () => {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected');

        // 1. Find the Dependent
        const dependent = await Dependent.findByPk(dependentId);
        if (!dependent) {
            throw new Error(`Dependent with ID ${dependentId} not found`);
        }

        if (dependent.linkedMemberId) {
            throw new Error(`Dependent is already linked to Member ID ${dependent.linkedMemberId}`);
        }

        // CRITICAL: Only dependents with phone numbers can be promoted (required for login)
        if (!dependent.phone || dependent.phone.trim() === '') {
            throw new Error(`Dependent ${dependent.firstName} ${dependent.lastName} does not have a phone number. Phone is required for login and cannot be promoted.`);
        }

        console.log(`Found Dependent: ${dependent.firstName} ${dependent.lastName} (ID: ${dependent.id})`);
        console.log(`Phone: ${dependent.phone}`);

        // 2. Find the Parent/Member
        const parent = await Member.findByPk(dependent.memberId);
        if (!parent) {
            throw new Error(`Parent member with ID ${dependent.memberId} not found`);
        }

        console.log(`Parent: ${parent.first_name} ${parent.last_name} (ID: ${parent.id})`);

        // Determine Family ID
        // If parent has a family_id, use it. If not, parent IS the family head, so use parent.id
        const familyId = parent.family_id || parent.id;
        console.log(`Family ID will be: ${familyId}`);

        // 3. Create New Member
        // Use dependent's phone (already validated to exist)
        // Email is optional - use provided, dependent's email, or generate placeholder
        const memberEmail = email || dependent.email || `dependent_${dependent.id}@placeholder.local`;
        const memberPhone = phone || dependent.phone; // Phone is guaranteed to exist from validation

        console.log(`Creating Member with Email: ${memberEmail}, Phone: ${memberPhone}`);

        const newMember = await Member.create({
            first_name: dependent.firstName,
            middle_name: dependent.middleName,
            last_name: dependent.lastName,
            email: memberEmail,
            phone_number: memberPhone,
            gender: dependent.gender,
            date_of_birth: dependent.dateOfBirth,
            family_id: familyId,
            yearly_pledge: 0, // CRITICAL: Zero pledge so they don't get billed separately
            role: 'member',
            is_active: true,
            registration_status: 'complete',
            household_size: 1, // Individual count
            address: parent.address, // Inherit address
            city: parent.city,
            state: parent.state,
            zip_code: parent.zip_code,
            country: parent.country
        });

        console.log(`✅ Created new Member: ${newMember.first_name} ${newMember.last_name} (ID: ${newMember.id})`);

        // 4. Link Dependent to New Member
        await dependent.update({ linkedMemberId: newMember.id });
        console.log(`✅ Linked Dependent ${dependent.id} to Member ${newMember.id}`);

        console.log('\n🎉 Promotion Complete!');
        console.log('------------------------------------------------');
        console.log(`New Member ID: ${newMember.id}`);
        console.log(`Login Email:   ${memberEmail}`);
        console.log(`Family ID:     ${familyId} (Linked to ${parent.first_name})`);
        console.log(`Pledge:        $0.00 (Covered by Family)`);
        console.log('------------------------------------------------');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
};

promoteDependent();
