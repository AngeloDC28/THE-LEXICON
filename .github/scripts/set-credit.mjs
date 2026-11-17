#!/usr/bin/env node
/**
 * set-credit.mjs: record a confirmed photo credit for one entry.
 *
 *   npm run credit -- <entry-id> "<credit exactly as printed>" "<source name>" <source URL>
 *   npm run credit -- prada-ss96 "Guy Marineau / Condé Nast" "Vogue Runway" https://www.vogue.com/fashion-shows/spring-1996-ready-to-wear/prada
 *
 * Writes photo_credit + image_source into content/entries/<id>.json, takes
 * the entry off content/credits-pending.json, and marks it in
 * content/credits-research.json. Only use a credit you have read on the
 * source page itself: never one inferred from the publisher or a repost.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [id, credit, sourceName, sourceUrl] = process.argv.slice(2);

function fail(msg) {
  console.error(`set-credit: ${msg}`);
  console.error('usage: npm run credit -- <entry-id> "<photo credit>" "<source name>" <source URL>');
  process.exit(1);
}

if (!id || !credit || !sourceName || !sourceUrl) fail('all four arguments are required');
if (!/^https?:\/\/\S+$/.test(sourceUrl)) fail(`source URL must start with http:// or https:// (got "${sourceUrl}")`);
if (credit.trim().length < 2) fail('credit is empty');

const entryPath = join(ROOT, 'content', 'entries', `${id}.json`);
if (!existsSync(entryPath)) fail(`no entry "${id}" in content/entries/`);

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

// Rebuild the entry so photo_credit and image_source sit together, in the
// same place for every entry, without disturbing the other keys' order.
const entry = readJson(entryPath);
const out = {};
for (const [k, v] of Object.entries(entry)) {
  if (k === 'image_source') continue;
  if (k === 'photo_credit') {
    out.photo_credit = credit.trim();
    out.image_source = { name: sourceName.trim(), url: sourceUrl.trim() };
    continue;
  }
  out[k] = v;
}
if (!('photo_credit' in out)) {
  out.photo_credit = credit.trim();
  out.image_source = { name: sourceName.trim(), url: sourceUrl.trim() };
}
writeJson(entryPath, out);

const pendingPath = join(ROOT, 'content', 'credits-pending.json');
const pending = readJson(pendingPath);
const before = pending.pending.length;
pending.pending = pending.pending.filter(p => p !== id);
writeJson(pendingPath, pending);

const researchPath = join(ROOT, 'content', 'credits-research.json');
if (existsSync(researchPath)) {
  const research = readJson(researchPath);
  if (research.entries?.[id]) {
    research.entries[id].credited = { credit: credit.trim(), source: sourceName.trim(), url: sourceUrl.trim(), date: new Date().toISOString().slice(0, 10) };
    writeJson(researchPath, research);
  }
}

console.log(`set-credit: ${id} → "${credit.trim()}" via ${sourceName.trim()}`);
console.log(`  ${before === pending.pending.length ? 'was not on' : 'removed from'} credits-pending.json (${pending.pending.length} still pending)`);
console.log('  run `npm run check` before committing.');
