const { Member, Dependent, sequelize } = require('./src/models');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // Find Tadesse Araya
        const member = await Member.findOne({
            where: { first_name: 'Tadesse', last_name: 'Araya' }
        });

        if (!member) {
            console.log('❌ Member not found');
            process.exit(1);
        }

        console.log(`✅ Found member: ${member.first_name} ${member.last_name} (ID: ${member.id})`);

        // Create test dependent
        const testDependent = await Dependent.create({
            memberId: member.id,
            firstName: 'TestYouth',
            lastName: 'Araya',
            phone: '+14155559999',
            email: 'testyouth@example.com',
            relationship: 'Son',
            gender: 'male',
            dateOfBirth: '2008-05-15',
            isBaptized: false,
            interestedInServing: 'yes'
        });

        console.log('✅ Created test dependent:');
        console.log(`   ID: ${testDependent.id}`);
        console.log(`   Name: ${testDependent.firstName} ${testDependent.lastName}`);
        console.log(`   Phone: ${testDependent.phone}`);
        console.log(`   LinkedMemberId: ${testDependent.linkedMemberId || 'null (ready for promotion!)'}`);
        console.log('\n🎉 Test dependent created successfully!');
        console.log('👉 Go to Admin → Manage Members → Tadesse Araya → Family tab to see the Promote button');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
