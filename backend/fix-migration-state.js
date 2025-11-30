require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false
});

async function fixState() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const migrationsToMark = [
            '20250928192000-create-ledger-entries.js',
            '20250928211204-add-transaction-id-to-ledger-entries.js',
            '20250928212447-add-transaction-id-to-ledger-entries.js',
            '20250930173500_cleanup_ledger_entries.js'
        ];

        for (const migration of migrationsToMark) {
            // Check if already exists
            const [results] = await sequelize.query(`SELECT name FROM "SequelizeMeta" WHERE name = '${migration}'`);
            if (results.length === 0) {
                await sequelize.query(`INSERT INTO "SequelizeMeta" (name) VALUES ('${migration}')`);
                console.log(`Marked ${migration} as executed.`);
            } else {
                console.log(`${migration} is already marked as executed.`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

fixState();
