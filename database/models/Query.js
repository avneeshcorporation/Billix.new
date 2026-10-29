const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Query = sequelize.define('Query', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
    text: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'Pending' },
    date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    replies: { type: DataTypes.JSONB, defaultValue: [] }
}, {
    timestamps: false
});

module.exports = Query;
