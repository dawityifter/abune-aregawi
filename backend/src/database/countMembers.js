require('dotenv').config();
const { sequelize, Member, Dependent, MemberPayment } = require('../models');

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
    
    // Count all members
    const memberCount = await Member.count();
    console.log(`📊 Members table: ${memberCount} records`);
    
    // Count dependents
    const dependentCount = await Dependent.count();
    console.log(`📊 Dependents table: ${dependentCount} records`);
    
    // Count payments
    const paymentCount = await MemberPayment.count();
    console.log(`📊 MemberPayments table: ${paymentCount} records`);
    
    // Get some sample data
    if (memberCount > 0) {
      console.log('\n📋 Sample members (first 5):');
      const sampleMembers = await Member.findAll({
        limit: 5,
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'created_at']
      });
      
      sampleMembers.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.first_name} ${member.last_name} (${member.email}) - ${member.phone_number}`);
      });
    }
    
    if (dependentCount > 0) {
      console.log('\n📋 Sample dependents (first 5):');
      const sampleDependants = await Dependent.findAll({
        limit: 5,
        include: [{ model: Member, attributes: ['first_name', 'last_name'] }],
        attributes: ['id', 'first_name', 'last_name', 'relationship']
      });
      
      sampleDependants.forEach((dependent, index) => {
        const memberName = dependent.Member ? `${dependent.Member.first_name} ${dependent.Member.last_name}` : 'Unknown';
        console.log(`  ${index + 1}. ${dependent.first_name} ${dependent.last_name} (${dependent.relationship}) - Member: ${memberName}`);
      });
    }
    
    if (paymentCount > 0) {
      console.log('\n📋 Sample payments (first 5):');
      const samplePayments = await MemberPayment.findAll({
        limit: 5,
        include: [{ model: Member, attributes: ['first_name', 'last_name'] }],
        attributes: ['id', 'amount', 'payment_date', 'payment_method', 'description']
      });
      
      samplePayments.forEach((payment, index) => {
        const memberName = payment.Member ? `${payment.Member.first_name} ${payment.Member.last_name}` : 'Unknown';
        console.log(`  ${index + 1}. $${payment.amount} - ${payment.payment_method} - ${memberName} (${payment.payment_date})`);
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