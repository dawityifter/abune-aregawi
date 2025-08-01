require('dotenv').config();
const { sequelize, Member, Dependant, MemberPayment } = require('../models');

const countMembers = async () => {
  try {
    console.log('🔍 Checking database records...');
    console.log('🔍 Environment Debug:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('  DATABASE_URL preview:', process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.substring(0, 20) + '...' + process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 20) : 
      'NOT SET');
    
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Count members
    const memberCount = await Member.count();
    console.log(`📊 Members table: ${memberCount} records`);
    
    // Count dependants
    const dependantCount = await Dependant.count();
    console.log(`📊 Dependants table: ${dependantCount} records`);
    
    // Count payments
    const paymentCount = await MemberPayment.count();
    console.log(`📊 MemberPayments table: ${paymentCount} records`);
    
    // Get some sample data
    if (memberCount > 0) {
      console.log('\n📋 Sample members (first 5):');
      const sampleMembers = await Member.findAll({
        limit: 5,
        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'createdAt']
      });
      
      sampleMembers.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.firstName} ${member.lastName} (${member.email}) - ${member.phoneNumber}`);
      });
    }
    
    if (dependantCount > 0) {
      console.log('\n📋 Sample dependants (first 5):');
      const sampleDependants = await Dependant.findAll({
        limit: 5,
        include: [{ model: Member, attributes: ['firstName', 'lastName'] }],
        attributes: ['id', 'firstName', 'lastName', 'relationship']
      });
      
      sampleDependants.forEach((dependant, index) => {
        const memberName = dependant.Member ? `${dependant.Member.firstName} ${dependant.Member.lastName}` : 'Unknown';
        console.log(`  ${index + 1}. ${dependant.firstName} ${dependant.lastName} (${dependant.relationship}) - Member: ${memberName}`);
      });
    }
    
    if (paymentCount > 0) {
      console.log('\n📋 Sample payments (first 5):');
      const samplePayments = await MemberPayment.findAll({
        limit: 5,
        include: [{ model: Member, attributes: ['firstName', 'lastName'] }],
        attributes: ['id', 'amount', 'paymentDate', 'paymentMethod', 'description']
      });
      
      samplePayments.forEach((payment, index) => {
        const memberName = payment.Member ? `${payment.Member.firstName} ${payment.Member.lastName}` : 'Unknown';
        console.log(`  ${index + 1}. $${payment.amount} - ${payment.paymentMethod} - ${memberName} (${payment.paymentDate})`);
      });
    }
    
    await sequelize.close();
    console.log('\n✅ Database connection closed.');
    
  } catch (error) {
    console.error('❌ Database count failed:', error.message);
    console.error('❌ Full error:', error);
    process.exit(1);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  countMembers();
}

module.exports = { countMembers }; 