require('dotenv').config();

const useSSL = String(process.env.DB_SSL || '').toLowerCase() === 'true';

module.exports = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : {},
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : {},
    logging: false
  }
};
