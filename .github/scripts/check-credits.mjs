#!/usr/bin/env node
/**
 * check-credits.mjs
 *
 * Every entry must say who took its photographs and where they came from
 * (photo_credit + image_source). The Terms promise credits "where known",
 * and sufficient acknowledgement is part of the s.30 fair-dealing position.
 *
 * Entries still being researched are listed in content/credits-pending.json.
 * The build fails when:
 *   - an entry has no credit/source and is NOT on the pending list
 *     (so a new entry can't ship uncredited), or
 *   - an entry IS on the pending list but already has both
 *     (so the list can only shrink — remove it once credited).
 *
 * Zero dependencies. Runs in `npm run check` and CI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const pending = new Set(JSON.parse(readFileSync(join(ROOT, 'content', 'credits-pending.json'), 'utf8')).pending || []);

const problems = [];
let credited = 0;
const ids = new Set();
for (const f of readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
  const e = JSON.parse(readFileSync(join(ENTRIES, f), 'utf8'));
  ids.add(e.id);
  const has = !!(e.photo_credit && e.photo_credit.trim()) && !!e.image_source?.url;
  if (has) credited++;
  if (!has && !pending.has(e.id)) problems.push(`${e.id}: no photo_credit / image_source, and not listed in content/credits-pending.json`);
  if (has && pending.has(e.id)) problems.push(`${e.id}: now credited — remove it from content/credits-pending.json`);
}
for (const id of pending) if (!ids.has(id)) problems.push(`credits-pending.json lists "${id}", which is not an entry`);

if (problems.length) {
  console.error('\nCREDITS:');
  problems.forEach(p => console.error('  ' + p));
  console.error('');
  process.exit(1);
}
console.log(`LEXICON_CREDITS ok (${credited} credited, ${pending.size} pending)`);
