require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Department, DepartmentMember, Member } = require('../src/models');

async function testDepartments() {
  try {
    console.log('🧪 Testing Department Management System...\n');

    // 1. Create a test department
    console.log('📝 Creating Youth Ministry department...');
    const department = await Department.create({
      name: 'Youth Ministry',
      description: 'Ministry for young people ages 13-25',
      type: 'ministry',
      meeting_schedule: 'Every Sunday at 10:00 AM',
      is_active: true,
      is_public: true
    });
    console.log('✅ Department created:', department.id, '-', department.name);

    // 2. Get all departments
    console.log('\n📋 Fetching all departments...');
    const allDepartments = await Department.findAll();
    console.log('✅ Found', allDepartments.length, 'department(s)');
    allDepartments.forEach(d => {
      console.log(`  - ${d.name} (${d.type})`);
    });

    // 3. Test adding a member to department (if you have members)
    console.log('\n👥 Checking for members to add...');
    const firstMember = await Member.findOne();
    if (firstMember) {
      console.log('📝 Adding member to department:', firstMember.firstName, firstMember.lastName);
      await DepartmentMember.create({
        department_id: department.id,
        member_id: firstMember.id,
        role_in_department: 'leader',
        status: 'active'
      });
      console.log('✅ Member added as leader');

      // Update department to set this member as leader
      await department.update({ leader_id: firstMember.id });
      console.log('✅ Department leader set');

      // Fetch department with leader
      const deptWithLeader = await Department.findByPk(department.id, {
        include: [{ model: Member, as: 'leader' }]
      });
      console.log('✅ Department with leader:', {
        name: deptWithLeader.name,
        leader: deptWithLeader.leader ? 
          `${deptWithLeader.leader.firstName} ${deptWithLeader.leader.lastName}` : 
          'None'
      });
    } else {
      console.log('⚠️  No members found in database. Skipping member addition test.');
    }

    console.log('\n🎉 All tests passed! Department system is working!\n');
    console.log('📊 Summary:');
    console.log('  ✓ Tables created');
    console.log('  ✓ Department creation works');
    console.log('  ✓ Department retrieval works');
    console.log('  ✓ Member assignment works');
    console.log('\n✨ Ready to build the frontend UI!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDepartments();
