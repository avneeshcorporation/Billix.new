const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });

const sequelize = require('./models/db');
require('./models/Invoice');
require('./models/Query');
require('./models/Ledger');
require('./models/LedgerDownloadRequest');

async function setupDatabase() {
    try {
        await sequelize.authenticate();
        // Plain sync creates missing tables without changing or dropping
        // existing columns. Never use force or alter for this setup command.
        await sequelize.sync();
        console.log('Database is connected and missing Billix tables were created.');
    } catch (error) {
        console.error('Database setup failed:', error.name);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

setupDatabase();
