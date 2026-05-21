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
const APP   = join(ROOT, 'js', 'app.js');

let version;
try {
  version = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // Git not available — fall back to timestamp truncated to 8 chars.
  version = Math.floor(Date.now() / 1000).toString(36);
}

let totalTouched = 0;

// ── 1) Stamp the <script> and <link> tags in index.html ──
// These are the entry-point requests the browser makes for the
// page-level JS bundle and stylesheet. Versioning them is what
// makes the browser fetch fresh app.js + index.css after a deploy.
const html = readFileSync(HTML, 'utf8');
const htmlPatterns = [
  [/(\bsrc=")(js\/app\.js)(\?v=[^"]*)?(")/g,            `$1$2?v=${version}$4`],
  [/(\brel="stylesheet"\s+href=")(index\.css)(\?v=[^"]*)?(")/g, `$1$2?v=${version}$4`],
];
let nextHtml = html;
for (const [re, rep] of htmlPatterns) {
  const before = nextHtml;
  nextHtml = nextHtml.replace(re, rep);
  if (nextHtml !== before) totalTouched++;
}
if (nextHtml !== html) writeFileSync(HTML, nextHtml, 'utf8');

// ── 2) Stamp the database.js ES-module import inside js/app.js ──
// database.js is loaded via `import { archiveData } from '../database.js'`
// at the top of app.js. Browsers cache module URLs aggressively and a
// fresh app.js will happily re-use a stale ../database.js if the import
// URL hasn't changed — which is how stale entry data (old slugs, missing
// images) survives across deploys. Appending ?v=<sha> to this one import
// forces a re-fetch on every commit.
//
// IMPORTANT: only database.js gets this treatment. The modules under
// js/modules/ import each other (e.g. render-detail.js imports from
// core-state.js), so any module imported from multiple sites would
// fork into two instances if cache-busted here but not at every call
// site — splitting shared state like AppState. Module code changes
// infrequently and is governed by Firebase's standard 1-hour HTTP
// cache, which is good enough for those.
const app = readFileSync(APP, 'utf8');
const appPatterns = [
  // Static import (legacy): import { x } from '../database.js'
  [/(from\s+['"])(\.\.\/database\.js)(\?v=[^'"]*)?(['"])/g,
   `$1$2?v=${version}$4`],
  // Dynamic import (Supabase fallback): await import('../database.js')
  // Stamping the dynamic import URL forces the browser to treat each deploy
  // as a fresh module even on the fallback path.
  [/(import\(['"])(\.\.\/database\.js)(\?v=[^'"]*)?(['"])/g,
   `$1$2?v=${version}$4`],
];
let nextApp = app;
for (const [re, rep] of appPatterns) {
  const before = nextApp;
  nextApp = nextApp.replace(re, rep);
  if (nextApp !== before) totalTouched++;
}
if (nextApp !== app) writeFileSync(APP, nextApp, 'utf8');

if (nextHtml === html && nextApp === app) {
  console.log(`LEXICON_BUST_CACHE ok (already ${version} or no targets matched)`);
  process.exit(0);
}

console.log(`LEXICON_BUST_CACHE ok (set ?v=${version} on ${totalTouched} reference batch(es) across index.html + app.js)`);
