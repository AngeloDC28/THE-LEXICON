#!/usr/bin/env node
/**
 * Verify every images[].src referenced by an entry exists on disk under
 * public/. Catches typos and accidentally-not-committed images at PR time
 * instead of as broken thumbnails on prod.
 *
 * Also warns about asset files on disk that no entry references (orphans).
 * Orphans are warnings, not failures — they often happen mid-PR.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT      = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES   = join(ROOT, 'content', 'entries');
const ASSETS    = join(ROOT, 'public', 'THE-LEXICON-ASSETS');

function walk(dir, base = dir, out = new Set()) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.add(p.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return out;
}

const onDisk = walk(ASSETS);                // e.g. "mcqueen-ss99/mcqueen-ss99-01.jpg"
const referenced = new Set();
const missing = [];

// Skip _template.json and similar drafts.
const files = readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_'));
for (const f of files) {
  const entry = JSON.parse(readFileSync(join(ENTRIES, f), 'utf8'));
  for (const img of entry.images || []) {
    if (!img.src) continue;
    // src is stored as "THE-LEXICON-ASSETS/<id>/<file>", strip the prefix
    const rel = img.src.replace(/^THE-LEXICON-ASSETS\//, '');
    referenced.add(rel);
    if (!onDisk.has(rel)) missing.push(`${f}: ${img.src}`);
  }
}

const orphans = [...onDisk].filter(p => !referenced.has(p));

if (missing.length) {
  console.error('\nMISSING ASSETS (referenced in entry JSON but not on disk):');
  for (const m of missing) console.error('  - ' + m);
}
if (orphans.length) {
  console.warn(`\nORPHAN ASSETS (${orphans.length} files on disk not referenced by any entry):`);
  for (const o of orphans.slice(0, 10)) console.warn('  - ' + o);
  if (orphans.length > 10) console.warn(`  ... and ${orphans.length - 10} more`);
}

if (missing.length) {
  console.error(`\nLEXICON_ASSETS failed: ${missing.length} missing reference(s)`);
  process.exit(1);
}
console.log(`LEXICON_ASSETS ok (${referenced.size} referenced, ${onDisk.size} on disk, ${orphans.length} orphan)`);
