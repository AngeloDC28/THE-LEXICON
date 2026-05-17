#!/usr/bin/env node
/**
 * Walk every entry JSON, pull out all editorial English strings (titles,
 * subtitles, hotspot labels + descriptions, notes.{provenance,critique,strategy}),
 * and make sure each one exists as a key in content/translations/en.json with
 * key === value (the passthrough pattern getTranslation() already uses).
 *
 * Idempotent: only inserts MISSING keys, never overwrites existing translations.
 * Run after editing entries, before npm run translate-content.
 *
 * The render code calls getTranslation(rawEnglishString, lang) for every
 * editorial field — so the English string itself doubles as the translation
 * key. This script keeps en.json honest with the entries on disk.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const EN      = join(ROOT, 'content', 'translations', 'en.json');

const en = JSON.parse(readFileSync(EN, 'utf8'));

const collected = new Set();
function add(v) {
  if (typeof v === 'string' && v.trim()) collected.add(v.trim());
}

const files = readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_'));
for (const f of files) {
  const e = JSON.parse(readFileSync(join(ENTRIES, f), 'utf8'));
  add(e.title);
  add(e.subtitle);
  if (e.notes) {
    add(e.notes.provenance);
    add(e.notes.critique);
    add(e.notes.strategy);
  }
  for (const img of e.images || []) {
    for (const hs of img.hotspots || []) {
      add(hs.label);
      add(hs.description);
    }
  }
}

let added = 0;
for (const v of collected) {
  if (!(v in en)) { en[v] = v; added++; }
}

if (added === 0) {
  console.log(`LEXICON_SYNC_CONTENT_KEYS ok (no new keys; en.json already covers ${collected.size} editorial strings)`);
  process.exit(0);
}

writeFileSync(EN, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log(`LEXICON_SYNC_CONTENT_KEYS ok (added ${added} new keys; en.json now ${Object.keys(en).length} keys total)`);
