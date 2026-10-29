const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const frontendDirectory = path.join(projectRoot, 'frontend');
const publicDirectory = path.join(projectRoot, 'public');

if (!fs.existsSync(path.join(frontendDirectory, 'index.html'))) {
    throw new Error('Frontend entry point not found at frontend/index.html');
}

fs.mkdirSync(publicDirectory, { recursive: true });
fs.cpSync(frontendDirectory, publicDirectory, { recursive: true, force: true });
console.log('Copied frontend assets into public/ for Vercel CDN serving.');
