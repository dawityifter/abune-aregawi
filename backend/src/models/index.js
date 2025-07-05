const { Sequelize } = require('sequelize');

// Database configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
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