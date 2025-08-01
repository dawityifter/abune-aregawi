const { Sequelize } = require('sequelize');

// Test database connection
async function testConnection() {
  console.log('🔍 Testing Supabase database connection...');
  
  // Replace with your actual Supabase connection string
  const DATABASE_URL = process.env.DATABASE_URL || 'your-supabase-connection-string-here';
  
  console.log('📝 Connection string format:', DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
  
  try {
    const sequelize = new Sequelize(DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });
    
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT version()');
    console.log('📊 PostgreSQL version:', results[0].version);
    
    await sequelize.close();
    console.log('🔒 Connection closed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.message.includes('SCRAM-SERVER-FINAL-MESSAGE')) {
      console.log('\n💡 Suggested fixes:');
      console.log('1. Check if password contains special characters that need URL encoding');
      console.log('2. Ensure connection string ends with ?sslmode=require');
      console.log('3. Use the Connection Pooler URL from Supabase');
      console.log('4. Verify the connection string format is correct');
    }
  }
}

testConnection();
