const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Ledger = sequelize.define('Ledger', {
    account: { type: DataTypes.STRING, allowNull: false },
    accountNumber: { type: DataTypes.STRING, allowNull: false },
    monthOf: { type: DataTypes.STRING, allowNull: false },
    sheetNumber: { type: DataTypes.STRING, defaultValue: '1' },
    transactions: { type: DataTypes.JSONB, defaultValue: [] },
    totalDebit: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalCredit: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalBalanceDebit: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalBalanceCredit: { type: DataTypes.FLOAT, defaultValue: 0 }
}, {
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false
});

module.exports = Ledger;
