#!/usr/bin/env node
/**
 * Health dashboard for THE LEXICON archive.
 * Run: npm run stats
 *
 * Prints per-entry and aggregate stats:
 *   - Image count, hotspot count, notes word count
 *   - Translation coverage per language
 *   - Entries missing hotspots or thin notes
 *
 * Zero dependencies.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT         = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES_DIR  = join(ROOT, 'content', 'entries');
const TRANS_DIR    = join(ROOT, 'content', 'translations');
const ORDER_FILE   = join(ROOT, 'content', 'order.json');

// ── helpers ─────────────────────────────────────────────────────────────────

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function rpad(str, len) {
  return String(str).padStart(len);
}

// ── load entries ─────────────────────────────────────────────────────────────

const order = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));
const entryFiles = readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));

const entries = entryFiles.map(f => JSON.parse(readFileSync(join(ENTRIES_DIR, f), 'utf8')));

// ── load translations ─────────────────────────────────────────────────────────

const enPath = join(TRANS_DIR, 'en.json');
const enKeys = existsSync(enPath) ? Object.keys(JSON.parse(readFileSync(enPath, 'utf8'))) : [];

const langFiles = existsSync(TRANS_DIR)
  ? readdirSync(TRANS_DIR).filter(f => f.endsWith('.json') && f !== 'en.json')
  : [];

const transStats = langFiles.map(f => {
  const lang = f.replace('.json', '');
  const data = JSON.parse(readFileSync(join(TRANS_DIR, f), 'utf8'));
  const filled = enKeys.filter(k => data[k] && data[k].trim() !== '').length;
  return { lang, filled, total: enKeys.length, pct: enKeys.length ? Math.round(filled / enKeys.length * 100) : 0 };
});

// ── per-entry stats ───────────────────────────────────────────────────────────

const COL = { id: 28, imgs: 5, spots: 6, words: 6 };

const rows = entries.map(e => {
  const images  = e.images?.length ?? 0;
  const hotspots = (e.images ?? []).reduce((s, img) => s + (img.hotspots?.length ?? 0), 0);
  const words   = wordCount((e.notes?.provenance ?? '') + ' ' + (e.notes?.critique ?? '') + ' ' + (e.notes?.strategy ?? ''));
  const warn    = [];
  if (hotspots === 0)  warn.push('NO HOTSPOTS');
  if (words < 150)     warn.push('thin notes');
  if (images < 5)      warn.push('few images');
  return { id: e.id, images, hotspots, words, warn };
});

// ── print ─────────────────────────────────────────────────────────────────────

const DIVIDER = '─'.repeat(60);

console.log('\nTHE LEXICON — archive stats\n' + DIVIDER);
console.log(
  pad('entry', COL.id) +
  rpad('imgs', COL.imgs) +
  rpad('spots', COL.spots) +
  rpad('words', COL.words) +
  '  warnings'
);
console.log(DIVIDER);

for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
  const warn = r.warn.length ? '  !! ' + r.warn.join(', ') : '';
  console.log(
    pad(r.id, COL.id) +
    rpad(r.images,   COL.imgs) +
    rpad(r.hotspots, COL.spots) +
    rpad(r.words,    COL.words) +
    warn
  );
}

console.log(DIVIDER);

const totalImgs   = rows.reduce((s, r) => s + r.images,   0);
const totalSpots  = rows.reduce((s, r) => s + r.hotspots, 0);
const totalWords  = rows.reduce((s, r) => s + r.words,    0);
const avgImgs     = (totalImgs  / rows.length).toFixed(1);
const avgSpots    = (totalSpots / rows.length).toFixed(1);

console.log(
  pad(`TOTAL (${rows.length} entries)`, COL.id) +
  rpad(totalImgs,  COL.imgs) +
  rpad(totalSpots, COL.spots) +
  rpad(totalWords, COL.words)
);
console.log(
  pad('AVERAGE per entry', COL.id) +
  rpad(avgImgs,  COL.imgs) +
  rpad(avgSpots, COL.spots)
);

// ── translation coverage ──────────────────────────────────────────────────────

if (transStats.length) {
  console.log('\n' + DIVIDER);
  console.log('translation coverage  (en baseline: ' + enKeys.length + ' keys)');
  console.log(DIVIDER);
  for (const t of transStats.sort((a, b) => b.pct - a.pct)) {
    const bar = '#'.repeat(Math.round(t.pct / 5)).padEnd(20);
    console.log(`  ${pad(t.lang, 8)} [${bar}] ${rpad(t.pct, 3)}%  (${t.filled}/${t.total})`);
  }
}

// ── warnings summary ─────────────────────────────────────────────────────────

const flagged = rows.filter(r => r.warn.length);
if (flagged.length) {
  console.log('\n' + DIVIDER);
  console.log('entries needing attention:');
  for (const r of flagged) {
    console.log(`  ${r.id}: ${r.warn.join(', ')}`);
  }
}

console.log('\n' + DIVIDER + '\n');
