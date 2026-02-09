const { sequelize } = require('../../models');

async function addForYearColumn() {
    try {
        console.log('Adding for_year column to transactions table...');

        // Set schema to public for Supabase
        await sequelize.query(`SET search_path TO public;`);

        // Add column if it doesn't exist
        await sequelize.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS for_year INTEGER DEFAULT NULL;
    `);

        console.log('✅ for_year column added successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    addForYearColumn()
        .then(() => {
            console.log('✅ Done');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error:', error);
            process.exit(1);
        });
}

module.exports = addForYearColumn;
