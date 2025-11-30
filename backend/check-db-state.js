require('dotenv').config();
const { Sequelize } = require('sequelize');

// Override with the connection string if provided
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false
});

async function checkState() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Check tables
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('Tables:', tables);

        // Check ledger_entries columns
        if (tables.includes('ledger_entries')) {
            const columns = await sequelize.getQueryInterface().describeTable('ledger_entries');
            console.log('ledger_entries columns:', Object.keys(columns));
        } else {
            console.log('ledger_entries table does not exist.');
        }

        // Check SequelizeMeta
        if (tables.includes('SequelizeMeta')) {
            const migrations = await sequelize.query('SELECT * FROM "SequelizeMeta"', { type: sequelize.QueryTypes.SELECT });
            console.log('Executed migrations:', migrations.map(m => m.name));
        } else {
            console.log('SequelizeMeta table does not exist.');
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

checkState();
