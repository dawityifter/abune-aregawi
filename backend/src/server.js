require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Debug logging for server startup
console.log('🚀 Starting server...');
console.log('🔍 Server Environment Debug:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PORT:', process.env.PORT);
console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL);

// Import routes
const memberRoutes = require('./routes/memberRoutes');
const memberPaymentRoutes = require('./routes/memberPaymentRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const churchTransactionRoutes = require('./routes/churchTransactionRoutes');
const donationRoutes = require('./routes/donationRoutes');

// Import database
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5001;

// Trust the first proxy (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration - Simplified for development
console.log('🔧 CORS Configuration:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set');

// Enable CORS for all routes with simplified configuration for development
const corsOptions = {
  origin: function (origin, callback) {
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, only allow specific origins
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : [];
      
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Root route for debugging
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Abune Aregawi Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      members: '/api/members',
      payments: '/api/payments',
      transactions: '/api/transactions'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Firebase test endpoint
app.get('/firebase-test', (req, res) => {
  const admin = require('firebase-admin');
  try {
    const firebaseStatus = {
      appsInitialized: admin.apps.length,
      serviceAccountExists: !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.length : 0
    };
    
    res.json({
      success: true,
      message: 'Firebase Admin SDK Status',
      firebase: firebaseStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Firebase Admin SDK Error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/members', memberRoutes);
app.use('/api/payments', memberPaymentRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/church-transactions', churchTransactionRoutes);
app.use('/api/donations', donationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Database connection and server startup
const startServer = async () => {
  try {
    console.log('🚀 Starting server...');
    
    // Debug environment variables
    console.log('🔍 Server Environment Debug:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  PORT:', PORT);
    console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('  FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('  FIREBASE_SERVICE_ACCOUNT_BASE64 exists:', !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);
    
    // Initialize database connection with better error handling
    console.log('🔌 Starting database connection...');
    let sequelize;
    
    try {
      const models = require('./models');
      sequelize = models.sequelize;
      console.log('✅ Models loaded successfully.');
    } catch (modelError) {
      console.error('❌ Failed to load models:', modelError.message);
      console.error('❌ Model error stack:', modelError.stack);
      throw modelError;
    }
    
    // Test database connection with retries
    console.log('🔌 Connecting to database...');
    let retries = 3;
    let dbConnected = false;
    
    while (retries > 0 && !dbConnected) {
      try {
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');
        dbConnected = true;
      } catch (dbError) {
        retries--;
        console.error(`❌ Database connection failed (${3 - retries}/3):`, dbError.message);
        
        if (retries === 0) {
          console.error('❌ All database connection attempts failed.');
          console.error('❌ Database error details:', {
            name: dbError.name,
            message: dbError.message,
            code: dbError.code,
            errno: dbError.errno
          });
          
          // Don't crash the server, just log the error and continue
          console.log('⚠️  Starting server without database connection for debugging...');
          break;
        }
        
        console.log(`🔄 Retrying database connection in 2 seconds... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Check if we're in a test environment
    if (process.env.NODE_ENV === 'test') {
      console.log('🧪 Test environment detected, skipping database sync.');
      return;
    }
    
    // Sync database (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Syncing database models...');
      try {
        await sequelize.sync({ force: false }); // Revert to force: false
        console.log('✅ Database synchronized.');
        // Log table information
        const tables = await sequelize.showAllSchemas();
        console.log('📋 Available tables:', tables.map(t => t.name).join(', '));
      } catch (syncError) {
        console.error('❌ Database sync failed:', syncError.message);
        throw syncError;
      }
    }
    
    // Start server
    console.log(`🚀 Starting HTTP server on port ${PORT}...`);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log('✅ Server startup completed successfully!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('❌ Error stack:', error.stack);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
  process.exit(0);
});

// Export the app for testing
module.exports = app;

// Only start the server if this file is run directly (not required by tests)
if (require.main === module) {
  startServer();
} 