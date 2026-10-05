const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const LedgerDownloadRequest = sequelize.define('LedgerDownloadRequest', {
    requestId: { type: DataTypes.STRING, allowNull: false, unique: true },
    ledgerId: { type: DataTypes.STRING, allowNull: false },
    account: { type: DataTypes.STRING, defaultValue: '' },
    accountNumber: { type: DataTypes.STRING, defaultValue: '' },
    fileType: { type: DataTypes.ENUM('excel', 'pdf'), allowNull: false },
    status: { type: DataTypes.ENUM('Requested', 'Processing', 'Ready', 'Failed'), defaultValue: 'Ready' },
    requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    errorMessage: { type: DataTypes.STRING, defaultValue: '' }
}, {
    timestamps: false
});

module.exports = LedgerDownloadRequest;
