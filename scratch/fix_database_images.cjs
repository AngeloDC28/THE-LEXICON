const fs = require('fs');
const path = require('path');

const DB_PATH = 'database.js';
const ASSETS_DIR = 'public/THE-LEXICON-ASSETS';

if (!fs.existsSync(DB_PATH)) {
    console.error("database.js not found at root.");
    process.exit(1);
}

let content = fs.readFileSync(DB_PATH, 'utf8');

// Split by entries. Each entry starts with "id":
const entries = content.split(/\{\s*"id":/);
let newContent = entries[0];

console.log(`Processing ${entries.length - 1} entries...`);

for (let i = 1; i < entries.length; i++) {
    let entry = entries[i];
    // Extract the ID (the string immediately following "id":)
    const idMatch = entry.match(/^\s*"([^"]+)"/);
    if (!idMatch) {
        console.warn(`Could not find ID in entry block ${i}`);
        newContent += '{\n    "id":' + entry;
        continue;
    }
    const id = idMatch[1];
    
    // Check if folder exists in THE-LEXICON-ASSETS
    const folderPath = path.join(ASSETS_DIR, id);
    if (fs.existsSync(folderPath)) {
        // Fix all image paths within this entry block
        // This regex catches both "data/folder/XX.jpg" and "THE-LEXICON-ASSETS/folder/XX.jpg"
        // It also handles prefixed names like "folder-XX.jpg"
        entry = entry.replace(/(data|THE-LEXICON-ASSETS)\/([-\w]+)\/([-\w]+-)?(\d+)\.jpg/g, (match, base, folder, prefix, num) => {
            // We force it to use the Entry ID as the folder and prefix
            return `THE-LEXICON-ASSETS/${id}/${id}-${num}.jpg`;
        });
        console.log(`Restored paths for: ${id}`);
    } else {
        console.warn(`Asset folder not found for entry ${id}, skipping path transformation.`);
    }
    
    newContent += '{\n    "id":' + entry;
}

fs.writeFileSync(DB_PATH, newContent);
console.log("Database image restoration complete.");
