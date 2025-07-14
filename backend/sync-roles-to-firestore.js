const { Sequelize } = require('sequelize');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Initialize PostgreSQL connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function syncRolesToFirestore() {
  try {
    console.log('🔄 Starting role sync from PostgreSQL to Firestore...');
    
    // Connect to PostgreSQL
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database');
    
    // Get all members from PostgreSQL
    const [members] = await sequelize.query(`
      SELECT 
        id,
        email,
        login_email,
        role,
        first_name,
        last_name,
        firebase_uid
      FROM members 
      WHERE is_active = true
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${members.length} active members in PostgreSQL`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const member of members) {
      try {
        // Try to find user in Firestore by email
        const usersRef = db.collection('users');
        const query = usersRef.where('email', '==', member.email || member.login_email);
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
          // Update the first matching user document
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            role: member.role,
            updatedAt: new Date().toISOString(),
            syncedFromPostgreSQL: true
          });
          
          console.log(`✅ Updated Firestore user ${member.email}: ${member.role}`);
          updatedCount++;
        } else {
          console.log(`⚠️  No Firestore user found for email: ${member.email || member.login_email}`);
        }
      } catch (error) {
        console.error(`❌ Error updating user ${member.email}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`📋 Total processed: ${members.length} users`);
    
  } catch (error) {
    console.error('❌ Error during role sync:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Also create a function to sync from Firestore to PostgreSQL
async function syncRolesToPostgreSQL() {
  try {
    console.log('🔄 Starting role sync from Firestore to PostgreSQL...');
    
    // Connect to PostgreSQL
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database');
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.size} users in Firestore`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const email = userData.email;
        
        if (!email) {
          console.log(`⚠️  User ${userDoc.id} has no email`);
          continue;
        }
        
        // Update PostgreSQL member with Firestore role
        const [result] = await sequelize.query(`
          UPDATE members 
          SET role = $1, updated_at = NOW()
          WHERE email = $2 OR login_email = $2
        `, {
          replacements: [userData.role || 'member', email]
        });
        
        if (result.rowCount > 0) {
          console.log(`✅ Updated PostgreSQL member ${email}: ${userData.role || 'member'}`);
          updatedCount++;
        } else {
          console.log(`⚠️  No PostgreSQL member found for email: ${email}`);
        }
      } catch (error) {
        console.error(`❌ Error updating member ${userDoc.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} members`);
    console.log(`❌ Errors: ${errorCount} members`);
    console.log(`📋 Total processed: ${usersSnapshot.size} users`);
    
  } catch (error) {
    console.error('❌ Error during role sync:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Check command line arguments
const direction = process.argv[2];

if (direction === 'to-firestore') {
  syncRolesToFirestore();
} else if (direction === 'to-postgresql') {
  syncRolesToPostgreSQL();
} else {
  console.log('Usage:');
  console.log('  node sync-roles-to-firestore.js to-firestore    # Sync from PostgreSQL to Firestore');
  console.log('  node sync-roles-to-firestore.js to-postgresql   # Sync from Firestore to PostgreSQL');
  process.exit(1);
} 