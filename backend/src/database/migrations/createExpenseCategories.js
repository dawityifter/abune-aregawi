const { sequelize } = require('../../models');

async function createExpenseCategoriesTable() {
  try {
    console.log('Creating expense_categories table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gl_code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_fixed BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log('✅ expense_categories table created');

    // Create indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_expense_categories_gl_code 
      ON expense_categories(gl_code);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_expense_categories_is_active 
      ON expense_categories(is_active);
    `);

    console.log('✅ Indexes created for expense_categories');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createExpenseCategoriesTable()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = createExpenseCategoriesTable;
