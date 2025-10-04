const { sequelize } = require('../../models');

async function addIncomeCategorySupport() {
  try {
    console.log('🔧 Adding income category support...');

    // Set schema to public for Supabase
    await sequelize.query(`SET search_path TO public;`);

    // Step 1: Create income_categories table
    console.log('\n📋 Step 1: Creating income_categories table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS income_categories (
        id BIGSERIAL PRIMARY KEY,
        gl_code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        payment_type_mapping VARCHAR(50),
        is_active BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ income_categories table created');

    // Step 2: Create indexes on income_categories
    console.log('\n📋 Step 2: Creating indexes on income_categories...');
    
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_income_categories_gl_code 
        ON income_categories(gl_code);
      `);
      console.log('✅ Index on gl_code created');
    } catch (err) {
      console.log('ℹ️  Index on gl_code already exists');
    }

    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_income_categories_is_active 
        ON income_categories(is_active);
      `);
      console.log('✅ Index on is_active created');
    } catch (err) {
      console.log('ℹ️  Index on is_active already exists');
    }

    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_income_categories_payment_type 
        ON income_categories(payment_type_mapping);
      `);
      console.log('✅ Index on payment_type_mapping created');
    } catch (err) {
      console.log('ℹ️  Index on payment_type_mapping already exists');
    }

    // Step 3: Add income_category_id column to transactions table
    console.log('\n📋 Step 3: Adding income_category_id to transactions table...');
    
    // Check if column already exists
    const checkColumnResult = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='transactions' 
      AND column_name='income_category_id';
    `, { type: sequelize.QueryTypes.SELECT });

    if (checkColumnResult.length === 0) {
      await sequelize.query(`
        ALTER TABLE transactions 
        ADD COLUMN income_category_id BIGINT NULL 
        REFERENCES income_categories(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL;
      `);
      console.log('✅ income_category_id column added to transactions');

      // Add index on income_category_id
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_transactions_income_category 
        ON transactions(income_category_id);
      `);
      console.log('✅ Index on income_category_id created');
    } else {
      console.log('ℹ️  income_category_id column already exists in transactions');
    }

    console.log('\n✅ Income category support added successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run db:seed:income');
    console.log('   2. Restart your backend server');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addIncomeCategorySupport()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = addIncomeCategorySupport;
