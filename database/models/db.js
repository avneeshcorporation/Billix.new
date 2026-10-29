const { Sequelize } = require('sequelize');
// Sequelize loads the PostgreSQL driver dynamically. Keep a direct import so
// Vercel's function tracer includes this runtime dependency in the bundle.
require('pg');

const databaseUrl = process.env.DATABASE_URL;
// Use a harmless local placeholder so the Vercel app can still load and serve
// its static frontend when DATABASE_URL has not been configured yet. API
// requests check for the real value before attempting a database connection.
const sequelizeUrl = databaseUrl || 'postgres://localhost:5432/billix';
const sslMode = databaseUrl ? new URL(databaseUrl).searchParams.get('sslmode') : null;
const sslRequired = process.env.VERCEL === '1' || ['require', 'verify-ca', 'verify-full'].includes(sslMode);

const sequelize = new Sequelize(sequelizeUrl, {
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
