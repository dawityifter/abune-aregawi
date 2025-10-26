/**
 * Quick script to check recent transactions and their Stripe IDs
 */

const { Transaction, Donation, sequelize } = require('./src/models');

async function checkRecentPayments() {
  try {
    console.log('🔍 Checking recent transactions...\n');

    // Recent transactions
    const transactions = await Transaction.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: ['id', 'member_id', 'amount', 'payment_method', 'payment_type', 'external_id', 'status', 'created_at']
    });

    console.log(`Found ${transactions.length} recent transactions:\n`);
    
    transactions.forEach(t => {
      console.log(`Transaction #${t.id}:`);
      console.log(`  Amount: $${t.amount}`);
      console.log(`  Method: ${t.payment_method}`);
      console.log(`  Type: ${t.payment_type}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  External ID (Stripe): ${t.external_id || 'N/A'}`);
      console.log(`  Created: ${t.created_at}`);
      console.log('');
    });

    // Recent donations
    const donations = await Donation.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: ['id', 'amount', 'donation_type', 'status', 'stripe_payment_intent_id', 'created_at']
    });

    console.log(`\nFound ${donations.length} recent donations:\n`);
    
    donations.forEach(d => {
      console.log(`Donation #${d.id}:`);
      console.log(`  Amount: $${d.amount}`);
      console.log(`  Type: ${d.donation_type}`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Stripe Payment Intent: ${d.stripe_payment_intent_id || 'N/A'}`);
      console.log(`  Created: ${d.created_at}`);
      console.log('');
    });

    // Stripe-specific transactions
    const stripeTransactions = await Transaction.findAll({
      where: {
        external_id: {
          [sequelize.Sequelize.Op.like]: 'pi_%'
        }
      },
      order: [['created_at', 'DESC']],
      limit: 5
    });

    console.log(`\n📊 Found ${stripeTransactions.length} Stripe transactions (external_id starts with 'pi_'):\n`);
    
    stripeTransactions.forEach(t => {
      console.log(`Transaction #${t.id}: ${t.external_id} - $${t.amount} - ${t.status}`);
    });

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRecentPayments();
