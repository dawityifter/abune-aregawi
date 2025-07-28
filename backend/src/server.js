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

// Import database
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the first proxy (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000'];

console.log('🔧 CORS Configuration:');
console.log('  Allowed Origins:', allowedOrigins);
console.log('  NODE_ENV:', process.env.NODE_ENV);

app.use(cors({
  origin: function (origin, callback) {
    console.log('🌐 CORS Request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log('✅ CORS: Allowing localhost request in development');
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS: Origin allowed');
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      console.log('   Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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
      payments: '/api/payments'
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

// API routes
app.use('/api/members', memberRoutes);
app.use('/api/payments', memberPaymentRoutes);

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