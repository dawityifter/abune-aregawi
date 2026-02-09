const { sequelize } = require('./models');
const fs = require('fs');
const path = require('path');

async function verify() {
    const outputFile = path.join(__dirname, 'migration_status.txt');
    try {
        const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'for_year';
    `);

        if (results.length > 0) {
            fs.writeFileSync(outputFile, 'SUCCESS: Column exists');
        } else {
            fs.writeFileSync(outputFile, 'FAILURE: Column missing');
        }
    } catch (err) {
        fs.writeFileSync(outputFile, 'ERROR: ' + err.message);
    } finally {
        process.exit(0);
    }
}

verify();
