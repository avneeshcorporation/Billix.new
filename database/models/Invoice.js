const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Invoice = sequelize.define('Invoice', {
    invNo: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false },
    buyer: { type: DataTypes.STRING, allowNull: false },
    form: { type: DataTypes.JSONB, defaultValue: {} },
    products: { type: DataTypes.JSONB, defaultValue: [] },
}, {
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false
});

module.exports = Invoice;
