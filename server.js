const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./models/db');
const Invoice = require('./models/Invoice');
const Query = require('./models/Query');
const Ledger = require('./models/Ledger');
const LedgerDownloadRequest = require('./models/LedgerDownloadRequest');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Serve the frontend and API from one Render web service.
app.get('/', (req, res) => res.sendFile(require('path').join(__dirname, 'index.html')));
app.use((req, res, next) => {
    if (/^\/(?:node_modules|models|postman|\.git)(?:\/|$)/i.test(req.path) ||
        /^\/(?:server\.js|package(?:-lock)?\.json|\.env(?:\.|$))/i.test(req.path)) {
        return res.sendStatus(404);
    }
    next();
});
app.use(express.static(__dirname));

// Postgres connection and sync
sequelize.authenticate()
    .then(() => {
        console.log('Postgres connected successfully');
        return sequelize.sync({ alter: true }); // Automatically updates schema
    })
    .then(() => console.log('Database synced'))
    .catch(err => console.error('Postgres connection error:', err));

// --- Invoices API ---

// Get all invoices
app.get('/api/invoices', async (req, res) => {
    try {
        const invoices = await Invoice.findAll({ order: [['createdAt', 'DESC']] });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save a new invoice
app.post('/api/invoices', async (req, res) => {
    console.log("Received invoice to save:", req.body);
    try {
        const savedInvoice = await Invoice.create(req.body);
        console.log("Successfully saved invoice:", savedInvoice.id);
        res.status(201).json(savedInvoice);
    } catch (err) {
        console.error("Error saving invoice:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Queries API ---

// Get all queries
app.get('/api/queries', async (req, res) => {
    try {
        const queries = await Query.findAll({ order: [['date', 'DESC']] });
        res.json(queries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new query
app.post('/api/queries', async (req, res) => {
    try {
        const savedQuery = await Query.create(req.body);
        res.status(201).json(savedQuery);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a query (mark completed or add reply)
app.put('/api/queries/:id', async (req, res) => {
    try {
        const [updatedCount, [updatedQuery]] = await Query.update(req.body, {
            where: { id: req.params.id },
            returning: true
        });
        
        if (updatedCount === 0) {
            return res.status(404).json({ error: 'Query not found' });
        }
        res.json(updatedQuery);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Ledgers API ---

// Get all ledgers
app.get('/api/ledgers', async (req, res) => {
    try {
        const ledgers = await Ledger.findAll({ order: [['createdAt', 'DESC']] });
        res.json(ledgers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ledger by ID
app.get('/api/ledgers/:id', async (req, res) => {
    try {
        const ledger = await Ledger.findByPk(req.params.id);
        if (!ledger) return res.status(404).json({ error: 'Ledger not found' });
        res.json(ledger);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save a single ledger
app.post('/api/ledgers', async (req, res) => {
    try {
        const { account, accountNumber, monthOf, sheetNumber, transactions } = req.body;
        if (!account || !accountNumber || !monthOf) {
            return res.status(400).json({ error: 'Account, Account Number, and Month of are required' });
        }

        let totalDebit = 0;
        let totalCredit = 0;
        let totalBalanceDebit = 0;
        let totalBalanceCredit = 0;

        const formattedTransactions = (transactions || []).map(tx => {
            const debit = Number(tx.debit) || 0;
            const credit = Number(tx.credit) || 0;
            const balanceDebit = Number(tx.balanceDebit) || 0;
            const balanceCredit = Number(tx.balanceCredit) || 0;

            totalDebit += debit;
            totalCredit += credit;
            totalBalanceDebit += balanceDebit;
            totalBalanceCredit += balanceCredit;

            return {
                date: tx.date || new Date().toISOString().split('T')[0],
                description: tx.description || '',
                journalRef: tx.journalRef || '',
                debit,
                credit,
                balanceDebit,
                balanceCredit
            };
        });

        const savedLedger = await Ledger.create({
            account,
            accountNumber,
            monthOf,
            sheetNumber: sheetNumber || '1',
            transactions: formattedTransactions,
            totalDebit,
            totalCredit,
            totalBalanceDebit,
            totalBalanceCredit
        });

        res.status(201).json(savedLedger);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Validate Ledger Excel import payload
app.post('/api/ledgers/import/validate', (req, res) => {
    try {
        const { ledgers } = req.body; // Array of ledgers or items
        if (!Array.isArray(ledgers) || ledgers.length === 0) {
            return res.status(400).json({ error: 'No ledger data provided in upload' });
        }

        const errors = [];
        let validCount = 0;

        ledgers.forEach((item, index) => {
            const rowNum = index + 2; // Assuming row 1 is header
            if (!item.account || typeof item.account !== 'string' || !item.account.trim()) {
                errors.push({ row: rowNum, column: 'Account', message: 'Account name is required' });
            }
            if (!item.accountNumber || !String(item.accountNumber).trim()) {
                errors.push({ row: rowNum, column: 'Account Number', message: 'Account Number is required' });
            }
            if (!item.monthOf || !String(item.monthOf).trim()) {
                errors.push({ row: rowNum, column: 'Month of', message: 'Month of is required' });
            }
            if (item.debit !== undefined && item.debit !== null && isNaN(Number(item.debit))) {
                errors.push({ row: rowNum, column: 'Debit', message: 'Debit must be a valid number' });
            }
            if (item.credit !== undefined && item.credit !== null && isNaN(Number(item.credit))) {
                errors.push({ row: rowNum, column: 'Credit', message: 'Credit must be a valid number' });
            }
        });

        if (errors.length === 0) {
            validCount = ledgers.length;
        }

        res.json({
            totalRows: ledgers.length,
            validRecords: validCount,
            invalidRecords: errors.length,
            errors
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Batch Import Ledgers (All-or-nothing transaction safety)
app.post('/api/ledgers/import', async (req, res) => {
    try {
        const { ledgers } = req.body;
        if (!Array.isArray(ledgers) || ledgers.length === 0) {
            return res.status(400).json({ error: 'No ledgers to import' });
        }

        // Validate all records before saving anything
        const validationErrors = [];
        ledgers.forEach((item, index) => {
            const rowNum = index + 2;
            if (!item.account || !String(item.account).trim()) {
                validationErrors.push(`Row ${rowNum}: Missing Account Name`);
            }
            if (!item.accountNumber || !String(item.accountNumber).trim()) {
                validationErrors.push(`Row ${rowNum}: Missing Account Number`);
            }
            if (!item.monthOf || !String(item.monthOf).trim()) {
                validationErrors.push(`Row ${rowNum}: Missing Month of`);
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({
                error: 'Import aborted due to validation errors. No records were created.',
                details: validationErrors
            });
        }

        const groupedMap = new Map();
        ledgers.forEach(item => {
            const key = `${item.account.trim()}_${item.accountNumber.toString().trim()}_${item.monthOf.trim()}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    account: item.account.trim(),
                    accountNumber: String(item.accountNumber).trim(),
                    monthOf: String(item.monthOf).trim(),
                    sheetNumber: String(item.sheetNumber || '1').trim(),
                    transactions: []
                });
            }

            if (item.date || item.description || item.debit || item.credit) {
                groupedMap.get(key).transactions.push({
                    date: item.date || new Date().toISOString().split('T')[0],
                    description: item.description || 'Transaction',
                    journalRef: item.journalRef || '',
                    debit: Number(item.debit) || 0,
                    credit: Number(item.credit) || 0,
                    balanceDebit: Number(item.balanceDebit) || 0,
                    balanceCredit: Number(item.balanceCredit) || 0
                });
            }
        });

        const docsToSave = [];
        groupedMap.forEach(ledgerData => {
            let totalDebit = 0;
            let totalCredit = 0;
            let totalBalanceDebit = 0;
            let totalBalanceCredit = 0;

            ledgerData.transactions.forEach(tx => {
                totalDebit += tx.debit;
                totalCredit += tx.credit;
                totalBalanceDebit += tx.balanceDebit;
                totalBalanceCredit += tx.balanceCredit;
            });

            docsToSave.push({
                account: ledgerData.account,
                accountNumber: ledgerData.accountNumber,
                monthOf: ledgerData.monthOf,
                sheetNumber: ledgerData.sheetNumber,
                transactions: ledgerData.transactions,
                totalDebit,
                totalCredit,
                totalBalanceDebit,
                totalBalanceCredit
            });
        });

        const createdLedgers = await Ledger.bulkCreate(docsToSave);
        res.status(201).json({
            message: 'Ledger import successful',
            totalProcessed: ledgers.length,
            createdCount: createdLedgers.length,
            ledgers: createdLedgers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Log a Download Request
app.post('/api/ledgers/download-request', async (req, res) => {
    try {
        const { ledgerId, account, accountNumber, fileType } = req.body;
        if (!ledgerId || !fileType) {
            return res.status(400).json({ error: 'ledgerId and fileType are required' });
        }

        const requestId = 'REQ-' + Date.now();
        const savedRequest = await LedgerDownloadRequest.create({
            requestId,
            ledgerId,
            account: account || 'Ledger Document',
            accountNumber: accountNumber || '',
            fileType,
            status: 'Ready'
        });

        res.status(201).json(savedRequest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Download Requests history
app.get('/api/ledgers/download-requests', async (req, res) => {
    try {
        const requests = await LedgerDownloadRequest.findAll({ order: [['requestedAt', 'DESC']] });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
