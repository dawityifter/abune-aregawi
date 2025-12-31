'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const { sequelize } = queryInterface;

        try {
            console.log('🔧 Adding Tigray Hunger Fundraiser payment type to enum...');

            // Determine database dialect
            const dialect = sequelize.getDialect();
            console.log(`📡 Database dialect: ${dialect}`);

            if (dialect === 'postgres') {
                // Set schema to public for Supabase/Postgres
                await sequelize.query(`SET search_path TO public;`);

                // 1. Update enum_transactions_payment_type
                try {
                    // Check if enum exists first
                    const [currentValues] = await sequelize.query(`
                        SELECT unnest(enum_range(NULL::enum_transactions_payment_type)) as value;
                    `);

                    const exists = currentValues.some(v => v.value === 'tigray_hunger_fundraiser');

                    if (!exists) {
                        console.log(`\n📋 Adding payment type to enum_transactions_payment_type: tigray_hunger_fundraiser...`);
                        await sequelize.query(`
                            ALTER TYPE enum_transactions_payment_type 
                            ADD VALUE IF NOT EXISTS 'tigray_hunger_fundraiser';
                        `);
                        console.log(`✅ Added to enum_transactions_payment_type`);
                    }
                } catch (enumErr) {
                    console.warn(`ℹ️  Note: enum_transactions_payment_type check/update skipped: ${enumErr.message}`);
                }

                // 2. Update enum_ledger_entries_type
                try {
                    await sequelize.query(`
                        ALTER TYPE enum_ledger_entries_type 
                        ADD VALUE IF NOT EXISTS 'tigray_hunger_fundraiser';
                    `);
                    console.log(`✅ Added to enum_ledger_entries_type`);
                } catch (ledgerEnumError) {
                    console.log(`ℹ️  Note: enum_ledger_entries_type could not be updated (might not exist): ${ledgerEnumError.message}`);
                }
            }

            // 3. Regardless of dialect, ensure column lengths are sufficient
            // 'tigray_hunger_fundraiser' is 25 characters, but some tables have VARCHAR(20)
            console.log('📏 Checking and increasing column lengths in transactions table...');
            try {
                await sequelize.query(`
                    ALTER TABLE transactions 
                    ALTER COLUMN payment_type TYPE character varying(50),
                    ALTER COLUMN payment_method TYPE character varying(50);
                `);
                console.log('✅ Increased payment_type and payment_method column lengths to 50 in transactions');
            } catch (lenError) {
                console.log(`ℹ️  Note: Transactions column resize skipped: ${lenError.message}`);
            }

            // 4. Also check ledger_entries for consistency
            console.log('📏 Checking and increasing column lengths in ledger_entries table...');
            try {
                await sequelize.query(`
                    ALTER TABLE ledger_entries 
                    ALTER COLUMN type TYPE character varying(50),
                    ALTER COLUMN category TYPE character varying(100);
                `);
                console.log('✅ Increased ledger_entries column lengths');
            } catch (ledgerLenError) {
                console.log(`ℹ️  Note: Ledger entries column resize skipped: ${ledgerLenError.message}`);
            }

            console.log('\n✅ Migration completed successfully!');

        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Enums are hard to revert in Postgres without dropping the type, 
        // which would affect the whole table. We usually don't remove enum values in migrations.
        console.log('ℹ️  Down migration skipped for Tigray fundraiser payment type.');
    }
};
