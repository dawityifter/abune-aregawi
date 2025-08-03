require('dotenv').config();
const { sequelize } = require('./src/models');

async function checkTableStructure() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Get table structure
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'members' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Members table structure:');
    results.forEach(col => {
      console.log(`${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTableStructure();
