#!/usr/bin/env node
/**
 * Inject the current short git SHA as a cache-bust query string across
 * every same-origin JS/CSS reference the app loads: the <script>/<link>
 * tags in index.html, and every relative import (static or dynamic)
 * inside js/**\/*.js. Runs as part of preflight so every commit ships
 * fully versioned asset URLs.
 *
 * Browsers (and Vercel's edge cache) key on URL; without a query-string
 * change they keep serving the previously-cached file even after the
 * file on disk has changed. Bumping ?v=<sha> forces a fresh fetch,
 * invisible to the user — new code takes effect immediately on deploy
 * instead of waiting out the CDN's max-age.
 *
 * IMPORTANT: this must stamp *every* relative import consistently, not
 * just entry points. js/modules/*.js import each other (e.g.
 * render-detail.js imports core-state.js, which exports the shared
 * AppState singleton) — module identity in the browser is the resolved
 * URL, so if some importers got ?v=<sha> and others didn't, the same
 * file would resolve to two different URLs and load as two separate
 * module instances, forking shared state. Stamping every import site
 * with the same version string keeps every reference to a given module
 * resolving to the exact same URL, so there's exactly one instance.
 *
 * If git is unavailable (e.g. CI without history), falls back to the
 * current timestamp as a unique-per-run fallback.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = fileURLToPath(new URL('../../', import.meta.url));
const HTML   = join(ROOT, 'index.html');
const JS_DIR = join(ROOT, 'js');

let version;
try {
  version = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // Git not available — fall back to timestamp truncated to 8 chars.
  version = Math.floor(Date.now() / 1000).toString(36);
}

let totalTouched = 0;

// ── 1) Stamp the <script>/<link> entry-point tags in index.html ──
const html = readFileSync(HTML, 'utf8');
const htmlPatterns = [
  [/(\bsrc=")(\/js\/app\.js)(\?v=[^"]*)?(")/g,             `$1$2?v=${version}$4`],
  [/(\bsrc=")(\/js\/boot\.js)(\?v=[^"]*)?(")/g,            `$1$2?v=${version}$4`],
  [/(\brel="stylesheet"\s+href=")(\/index\.css)(\?v=[^"]*)?(")/g, `$1$2?v=${version}$4`],
];
let nextHtml = html;
for (const [re, rep] of htmlPatterns) {
  const before = nextHtml;
  nextHtml = nextHtml.replace(re, rep);
  if (nextHtml !== before) totalTouched++;
}
if (nextHtml !== html) writeFileSync(HTML, nextHtml, 'utf8');

// ── 2) Stamp every relative JS import across js/**/*.js ──
// Covers static `from '../x.js'` / `from './x.js'` and dynamic
// `import('../x.js')` / `import('./x.js')` — anything relative ending
// in .js. Bare specifiers (npm packages) are left untouched.
function listJsFiles(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out = out.concat(listJsFiles(full));
    else if (extname(name) === '.js') out.push(full);
  }
  return out;
}

const importPatterns = [
  // Static: import {...} from '../../database.js'
  [/(\bfrom\s+['"])(\.\.?\/[^'"]+?\.js)(\?v=[^'"]*)?(['"])/g, `$1$2?v=${version}$4`],
  // Dynamic: await import('../database.js')
  [/(\bimport\(\s*['"])(\.\.?\/[^'"]+?\.js)(\?v=[^'"]*)?(['"]\s*\))/g, `$1$2?v=${version}$4`],
];

for (const file of listJsFiles(JS_DIR)) {
  const src = readFileSync(file, 'utf8');
  let next = src;
  for (const [re, rep] of importPatterns) {
    const before = next;
    next = next.replace(re, rep);
    if (next !== before) totalTouched++;
  }
  if (next !== src) writeFileSync(file, next, 'utf8');
}

if (nextHtml === html && totalTouched === 0) {
  console.log(`LEXICON_BUST_CACHE ok (already ${version} or no targets matched)`);
  process.exit(0);
}

console.log(`LEXICON_BUST_CACHE ok (set ?v=${version} on ${totalTouched} reference batch(es) across index.html + js/**/*.js)`);
