// Vercel's Express runtime detects this root entry point and runs the exported
// Express application as a serverless function.
require('express');
module.exports = require('./backend/server');
