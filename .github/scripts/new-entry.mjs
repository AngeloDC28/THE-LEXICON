#!/usr/bin/env node
/**
 * Scaffold a new entry in one command. Usage:
 *   npm run new-entry <slug>
 *   npm run new-entry galliano-dior-aw00
 *
 * Does four things, refuses to clobber existing files:
 *   1. Copies content/entries/_template.json → content/entries/<slug>.json
 *      with the {{ID}} placeholders replaced by <slug>.
 *   2. Creates public/THE-LEXICON-ASSETS/<slug>/ if it doesn't exist.
 *   3. Appends <slug> to content/order.json if absent.
 *   4. Prints the exact next steps so the user knows what to do.
 *
 * Slug validation matches the entry.schema.json pattern: ^[a-z0-9-]+$
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = fileURLToPath(new URL('../../', import.meta.url));
const TEMPLATE = join(ROOT, 'content', 'entries', '_template.json');
const ORDER    = join(ROOT, 'content', 'order.json');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npm run new-entry <slug>');
  console.error('Example: npm run new-entry galliano-dior-aw00');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`Invalid slug "${slug}". Use lowercase letters, digits, and hyphens only.`);
  process.exit(1);
}

const entryPath = join(ROOT, 'content', 'entries', slug + '.json');
const assetDir  = join(ROOT, 'public', 'THE-LEXICON-ASSETS', slug);

let created = 0;

// 1. Entry JSON
if (existsSync(entryPath)) {
  console.log(`✓ entry already exists: content/entries/${slug}.json`);
} else {
  const tpl = readFileSync(TEMPLATE, 'utf8');
  const populated = tpl
    .replace(/REPLACE-WITH-KEBAB-CASE-ID/g, slug)
    .replace(/REPLACE-WITH-ID/g, slug);
  writeFileSync(entryPath, populated, 'utf8');
  console.log(`✓ created  content/entries/${slug}.json`);
  created++;
}

// 2. Asset folder
if (existsSync(assetDir)) {
  console.log(`✓ asset folder already exists: public/THE-LEXICON-ASSETS/${slug}/`);
} else {
  mkdirSync(assetDir, { recursive: true });
  console.log(`✓ created  public/THE-LEXICON-ASSETS/${slug}/`);
  created++;
}

// 3. Order registration
const order = JSON.parse(readFileSync(ORDER, 'utf8'));
if (order.includes(slug)) {
  console.log(`✓ already registered in content/order.json`);
} else {
  order.push(slug);
  writeFileSync(ORDER, JSON.stringify(order, null, 2) + '\n', 'utf8');
  console.log(`✓ appended to content/order.json (position ${order.length})`);
  created++;
}

// 4. Next steps
console.log('');
if (created === 0) {
  console.log('Nothing to do — this entry is already scaffolded.');
} else {
  console.log('Next steps:');
  console.log(`  1. Drop your images into public/THE-LEXICON-ASSETS/${slug}/`);
  console.log(`     Sequential, zero-padded: ${slug}-01.jpg, ${slug}-02.jpg, ...`);
  console.log(`  2. Edit content/entries/${slug}.json: title, tags, notes, hotspots per image`);
  console.log(`  3. npm run optimize-images     # resize >2400px + generate WebP siblings`);
  console.log(`  4. npm run sync-content-keys   # register new editorial strings`);
  console.log(`  5. npm run build-data && npm run build-translations`);
  console.log(`  6. npm run check               # validate before commit`);
}
