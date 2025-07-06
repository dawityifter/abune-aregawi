const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database configuration
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  }
});

// Import models
const Member = require('./Member')(sequelize);
const Child = require('./Child')(sequelize);

// Define associations
Member.associate({ Child, Member });
Child.associate({ Child, Member });

// Export models and sequelize instance
module.exports = {
  sequelize,
  Member,
  Child
}; 