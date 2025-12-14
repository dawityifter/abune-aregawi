const { BankTransaction } = require('../src/models');

async function fixDebits() {
    try {
        const txns = await BankTransaction.findAll();
        let count = 0;

        for (const txn of txns) {
            const raw = txn.raw_data;
            if (!raw) continue;

            // Check if it should be negative
            const isDebit = raw['Details'] === 'DEBIT' || raw['Details'] === 'CHKS P';
            const currentAmount = parseFloat(txn.amount);

            if (isDebit && currentAmount > 0) {
                console.log(`Fixing ID ${txn.id}: ${currentAmount} -> -${currentAmount}`);
                txn.amount = -Math.abs(currentAmount);
                await txn.save();
                count++;
            }
        }

        console.log(`Fixed ${count} debit transactions.`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

fixDebits();
