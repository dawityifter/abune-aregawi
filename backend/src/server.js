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

// Import database
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/members', memberRoutes);

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
    console.log('🔌 Starting database connection...');
    
    // Test database connection
    console.log('🔌 Connecting to database...');
    console.log(`📊 Database: Connected via DATABASE_URL`);
    
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully.');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      console.error('❌ Full database error:', dbError);
      throw dbError;
    }
    
    // Sync database (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Syncing database models (preserving existing data)...');
      try {
        await sequelize.sync({ force: false }); // force: false preserves existing data
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

startServer(); 