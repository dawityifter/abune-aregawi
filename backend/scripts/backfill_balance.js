const { BankTransaction, sequelize } = require('../src/models');

async function backfill() {
    try {
        const txns = await BankTransaction.findAll({
            where: { balance: null }
        });

        console.log(`Found ${txns.length} transactions to backfill.`);

        for (const txn of txns) {
            if (txn.raw_data && txn.raw_data.Balance) {
                txn.balance = parseFloat(txn.raw_data.Balance);
                await txn.save();
            }
        }

        console.log('Backfill complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error backfilling:', error);
        process.exit(1);
    }
}

backfill();
