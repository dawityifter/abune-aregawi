
const { Member } = require('./src/models');
const { sequelize } = require('./src/models');

async function checkMembers() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const members = await Member.findAll({
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'firebase_uid'],
      limit: 10
    });

    console.log('📋 Sample members:');
    members.forEach(m => {
      console.log(`ID: ${m.id}, Name: ${m.first_name} ${m.last_name}, Email: ${m.email}, Phone: ${m.phone_number}, FirebaseUID: ${m.firebase_uid || 'NULL'}`);
    });

    const totalMembers = await Member.count();
    console.log(`\n📊 Total members: ${totalMembers}`);

    const membersWithFirebaseUid = await Member.count({
      where: { firebase_uid: { [require('sequelize').Op.not]: null } }
    });
    console.log(`📊 Members with Firebase UID: ${membersWithFirebaseUid}`);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMembers(); 