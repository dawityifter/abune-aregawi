require('dotenv').config();
const { BankTransaction, sequelize } = require('./src/models');
const { Op } = require('sequelize');

async function fixGodaddyRefunds() {
  try {
    const transactions = await BankTransaction.findAll({
      where: {
        description: {
          [Op.iLike]: '%GODADDY%'
        },
        status: 'PENDING'
      }
    });

    let fixedCount = 0;

    for (const txn of transactions) {
      let raw;
      try {
        raw = typeof txn.raw_data === 'string' ? JSON.parse(txn.raw_data) : txn.raw_data;
      } catch (e) {
        continue; // Skip if invalid JSON
      }

      if (!raw || !raw.Amount) continue;

      const rawAmountStr = raw.Amount.toString().replace(/[$,]/g, '');
      const rawAmount = parseFloat(rawAmountStr);

      if (rawAmount > 0 && txn.amount < 0) {
        console.log(`Fixing transaction ID ${txn.id}: amount was ${txn.amount}, should be ${rawAmount}`);
        txn.amount = rawAmount;
        await txn.save();
        fixedCount++;
      }
    }

    console.log(`Successfully fixed ${fixedCount} GODADDY refund transactions.`);
  } catch (err) {
    console.error('Error fixing transactions:', err);
  } finally {
    process.exit(0);
  }
}

fixGodaddyRefunds();
