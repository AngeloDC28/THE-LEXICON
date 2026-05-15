const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.js');
const publicDataPath = path.join(__dirname, '..', 'public', 'data');

if (!fs.existsSync(dbPath)) {
  console.error('database.js not found');
  process.exit(1);
}

const content = fs.readFileSync(dbPath, 'utf8');

// Simple regex to find all "src": "data/..." or "imageUrl": "data/..."
const srcRegex = /"(?:src|imageUrl)":\s*"([^"]+)"/g;
let match;
const paths = [];

while ((match = srcRegex.exec(content)) !== null) {
  paths.push(match[1]);
}

console.log(`Found ${paths.length} image paths in database.js`);

let missingCount = 0;
paths.forEach(p => {
  // Normalize path: if it starts with data/, replace with public/data/
  const relativePath = p.replace(/^data\//, '');
  const absolutePath = path.join(publicDataPath, relativePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`MISSING: ${p} (Expected at ${absolutePath})`);
    missingCount++;
  }
});

if (missingCount === 0) {
  console.log('SUCCESS: All image paths validated.');
} else {
  console.error(`FAILURE: ${missingCount} images missing.`);
}
