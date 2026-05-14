
const db = require('../database.js');
console.log('Type of db:', typeof db);
console.log('Keys of db:', Object.keys(db));

const archiveData = Array.isArray(db) ? db : (db.archiveData || db.default);

if (!archiveData) {
    console.error('Could not find archiveData in module exports');
    process.exit(1);
}

let missingCount = 0;
archiveData.forEach((entry, i) => {
  const hasImages = entry.images && Array.isArray(entry.images) && entry.images.length > 0;
  const hasImageUrl = entry.imageUrl && typeof entry.imageUrl === 'string';
  
  if (!hasImages && !hasImageUrl) {
    console.log(`Entry ${i} (${entry.id}) is missing image data.`);
    missingCount++;
  }
});

if (missingCount === 0) {
  console.log('All entries have image data.');
} else {
  console.log(`${missingCount} entries are missing image data.`);
}
