const { sequelize } = require('../../models');

async function addTigrayFundraiserPaymentType() {
    try {
        console.log('🔧 Adding Tigray Hunger Fundraiser payment type to enum...');

        // Determine database dialect
        const dialect = sequelize.getDialect();
        console.log(`📡 Database dialect: ${dialect}`);

        if (dialect === 'postgres') {
            // Set schema to public for Supabase/Postgres
            await sequelize.query(`SET search_path TO public;`);

            // Get current enum values
            const currentValues = await sequelize.query(`
        SELECT unnest(enum_range(NULL::enum_transactions_payment_type)) as value;
      `, { type: sequelize.QueryTypes.SELECT });

            const exists = currentValues.some(v => v.value === 'tigray_hunger_fundraiser');

            if (!exists) {
                console.log(`\n📋 Adding payment type to enum_transactions_payment_type: tigray_hunger_fundraiser...`);
                await sequelize.query(`
          ALTER TYPE enum_transactions_payment_type 
          ADD VALUE IF NOT EXISTS 'tigray_hunger_fundraiser';
        `);
                console.log(`✅ Added to enum_transactions_payment_type`);
            }

            // Also add to enum_ledger_entries_type if it exists
            try {
                await sequelize.query(`
          ALTER TYPE enum_ledger_entries_type 
          ADD VALUE IF NOT EXISTS 'tigray_hunger_fundraiser';
        `);
                console.log(`✅ Added to enum_ledger_entries_type`);
            } catch (ledgerEnumError) {
                console.log(`ℹ️  Note: enum_ledger_entries_type could not be updated (might not exist or already updated): ${ledgerEnumError.message}`);
            }
        } else if (dialect === 'sqlite') {
            console.log('ℹ️  SQLite detected. Skipping ENUM modification as SQLite does not enforce ENUM constraints the same way or requires table recreation.');
            // In SQLite, DataTypes.ENUM is usually just a TEXT field with a CHECK constraint.
            // Modifying CHECK constraints in SQLite is complex (requires table recreation).
            // Since it's often used for local dev, we might skip or rely on Sequelize's sync (if used).
        }

        // 2. Regardless of dialect, ensure column lengths are sufficient
        // 'tigray_hunger_fundraiser' is 24 characters, but many local tables have VARCHAR(20)
        try {
            console.log('📏 Checking and increasing column lengths in transactions table...');
            await sequelize.query(`
                ALTER TABLE transactions 
                ALTER COLUMN payment_type TYPE character varying(50),
                ALTER COLUMN payment_method TYPE character varying(50);
            `);
            console.log('✅ Increased payment_type and payment_method column lengths to 50');
        } catch (lenError) {
            console.log(`ℹ️  Note: Could not increase column lengths (might be using ENUM or different naming): ${lenError.message}`);
        }

        // 3. Also check ledger_entries for consistency
        try {
            console.log('📏 Checking and increasing column lengths in ledger_entries table...');
            await sequelize.query(`
                ALTER TABLE ledger_entries 
                ALTER COLUMN type TYPE character varying(50),
                ALTER COLUMN category TYPE character varying(100);
            `);
            console.log('✅ Increased ledger_entries column lengths');
        } catch (ledgerLenError) {
            console.log(`ℹ️  Note: Could not increase column lengths in ledger_entries: ${ledgerLenError.message}`);
        }

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    addTigrayFundraiserPaymentType()
        .then(() => {
            console.log('✅ Done');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error:', error);
            process.exit(1);
        });
}

module.exports = addTigrayFundraiserPaymentType;
