#!/usr/bin/env node
/**
 * Inject the current short git SHA into index.html as a cache-bust
 * query string on app.js, index.css, and database.js. Runs as part of
 * preflight so every commit ships index.html with versioned asset URLs.
 *
 * Browsers cache by URL; without a query string change they keep using
 * the previously-cached JS even when the file on disk has been updated.
 * Bumping ?v=<sha> on every deploy forces a fresh fetch — invisible to
 * the user, just makes new code take effect immediately.
 *
 * If git is unavailable (e.g. CI without history), falls back to the
 * file's mtime as a unique-per-commit fallback.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = fileURLToPath(new URL('../../', import.meta.url));
const HTML  = join(ROOT, 'index.html');

let version;
try {
  version = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // Git not available — fall back to timestamp truncated to 8 chars.
  version = Math.floor(Date.now() / 1000).toString(36);
}

const src = readFileSync(HTML, 'utf8');

// Pattern matches existing ?v=<anything> or no query string at all.
// Updates: src="js/app.js"           → src="js/app.js?v=<sha>"
//          src="js/app.js?v=abc"     → src="js/app.js?v=<sha>"
//          href="index.css"          → href="index.css?v=<sha>"
const patterns = [
  [/(\bsrc=")(js\/app\.js)(\?v=[^"]*)?(")/g,            `$1$2?v=${version}$4`],
  [/(\brel="stylesheet"\s+href=")(index\.css)(\?v=[^"]*)?(")/g, `$1$2?v=${version}$4`],
  [/(\bsrc=")(database\.js)(\?v=[^"]*)?(")/g,            `$1$2?v=${version}$4`],
];

let next = src;
let touched = 0;
for (const [re, rep] of patterns) {
  const before = next;
  next = next.replace(re, rep);
  if (next !== before) touched++;
}

if (next === src) {
  console.log(`LEXICON_BUST_CACHE ok (already ${version} or no targets matched)`);
  process.exit(0);
}

writeFileSync(HTML, next, 'utf8');
console.log(`LEXICON_BUST_CACHE ok (set ?v=${version} on ${touched} asset reference(s))`);
