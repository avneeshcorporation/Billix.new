const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/billix', {
  dialect: 'postgres',
  logging: false, // Set to true to see SQL queries
});

module.exports = sequelize;
