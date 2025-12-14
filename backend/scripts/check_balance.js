const { BankTransaction, sequelize } = require('../src/models');

async function check() {
    try {
        const latestTxn = await BankTransaction.findOne({
            order: [['date', 'DESC'], ['id', 'DESC']],
            attributes: ['id', 'date', 'balance', 'raw_data']
        });

        console.log('Latest Transaction:', latestTxn ? latestTxn.toJSON() : 'None');

        // Also check if ANY have balance
        const countWithBalance = await BankTransaction.count({
            where: { balance: { [require('sequelize').Op.ne]: null } }
        });
        console.log('Count with balance:', countWithBalance);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

check();
