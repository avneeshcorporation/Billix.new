const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before using the database.');
}

const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
const sslRequired = process.env.VERCEL === '1' || ['require', 'verify-ca', 'verify-full'].includes(sslMode);

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: sslRequired ? {
    ssl: {}
  } : {},
  pool: {
    max: 2,
    min: 0,
    acquire: 10000,
    idle: 10000,
    evict: 1000
  }
});

module.exports = sequelize;
