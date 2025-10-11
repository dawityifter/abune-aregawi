const { sequelize } = require('../../models');

async function makeTransactionMemberIdNullable() {
  try {
    console.log('🔧 Making transactions.member_id nullable for anonymous payments...');

    // Set schema to public for Supabase
    await sequelize.query(`SET search_path TO public;`);

    // Step 1: Drop the existing foreign key constraint
    console.log('\n📋 Step 1: Dropping existing foreign key constraint...');
    await sequelize.query(`
      ALTER TABLE transactions 
      DROP CONSTRAINT IF EXISTS transactions_new_member_id_fkey;
    `);
    console.log('✅ Foreign key constraint dropped');

    // Step 2: Alter member_id column to allow NULL
    console.log('\n📋 Step 2: Altering member_id column to allow NULL...');
    await sequelize.query(`
      ALTER TABLE transactions 
      ALTER COLUMN member_id DROP NOT NULL;
    `);
    console.log('✅ member_id column now allows NULL values');

    // Step 3: Re-add foreign key constraint with SET NULL on delete
    console.log('\n📋 Step 3: Re-adding foreign key constraint with SET NULL...');
    await sequelize.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT transactions_new_member_id_fkey 
      FOREIGN KEY (member_id) 
      REFERENCES members(id) 
      ON UPDATE CASCADE 
      ON DELETE SET NULL;
    `);
    console.log('✅ Foreign key constraint re-added with SET NULL behavior');

    console.log('\n✅ Migration completed successfully!');
    console.log('   - member_id column now allows NULL for anonymous payments');
    console.log('   - Foreign key will SET NULL if member is deleted');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  makeTransactionMemberIdNullable()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = makeTransactionMemberIdNullable;
