'use strict';

/**
 * Extend payment_type ENUM to include: religious_item_sales
 * This is for sales of religious items (Bibles, candles, etc.) - not donations
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check which table name exists (transactions or church_transactions)
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('transactions', 'church_transactions')
    `);
    
    const tableName = tables.length > 0 ? tables[0].table_name : 'transactions';
    const enumTypeName = tableName === 'church_transactions' 
      ? 'enum_church_transactions_payment_type'
      : 'enum_transactions_payment_type';
    
    console.log(`📋 Adding religious_item_sales to ${enumTypeName} for table ${tableName}`);
    
    // Check if the enum value already exists
    const [enumCheck] = await queryInterface.sequelize.query(`
      SELECT 1 
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = '${enumTypeName}'
      AND e.enumlabel = 'religious_item_sales'
    `);
    
    if (enumCheck.length === 0) {
      // Add the new enum value
      // Note: ALTER TYPE ADD VALUE cannot be executed in a transaction block in some PostgreSQL versions
      // So we execute it directly
      await queryInterface.sequelize.query(`
        ALTER TYPE ${enumTypeName} ADD VALUE 'religious_item_sales'
      `);
      console.log(`✅ Added religious_item_sales to ${enumTypeName}`);
    } else {
      console.log(`ℹ️  Enum value religious_item_sales already exists in ${enumTypeName}`);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Check which table name exists
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('transactions', 'church_transactions')
    `);
    
    const tableName = tables.length > 0 ? tables[0].table_name : 'transactions';
    const enumTypeName = tableName === 'church_transactions' 
      ? 'enum_church_transactions_payment_type'
      : 'enum_transactions_payment_type';
    
    console.log(`📋 Removing religious_item_sales from ${enumTypeName} (coercing to 'other')`);
    
    // PostgreSQL doesn't support removing enum values directly
    // So we'll update any transactions using this type to 'other'
    await queryInterface.sequelize.query(`
      UPDATE ${tableName}
      SET payment_type = 'other'
      WHERE payment_type = 'religious_item_sales';
    `);
    
    console.log(`⚠️  Note: PostgreSQL doesn't support removing enum values.`);
    console.log(`   Any transactions with religious_item_sales have been changed to 'other'.`);
    console.log(`   To fully remove the enum value, you would need to recreate the enum type.`);
  }
};

