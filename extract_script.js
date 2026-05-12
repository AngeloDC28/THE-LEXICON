const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  fs.writeFileSync('temp_script.js', scriptMatch[1]);
  console.log('Extracted script to temp_script.js');
} else {
  console.log('No script tag found.');
}
