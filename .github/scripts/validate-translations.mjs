#!/usr/bin/env node
/**
 * Verify every non-English language file has every key present in en.json,
 * and that en.json itself has no empty values. Catches the "we added a
 * UI string in English and forgot to translate it" drift before it ships.
 *
 * Missing keys are warnings (we fall back to en at runtime).
 * Extra keys (in a non-en file but not in en) are warnings.
 * Empty/null values in en are failures.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = fileURLToPath(new URL('../../', import.meta.url));
const DIR   = join(ROOT, 'content', 'translations');
const ORDER = JSON.parse(readFileSync(join(DIR, '_order.json'), 'utf8'));

const en = JSON.parse(readFileSync(join(DIR, 'en.json'), 'utf8'));
const enKeys = new Set(Object.keys(en));

let failed = 0;
const warnings = [];

// en sanity: no empty values
for (const [k, v] of Object.entries(en)) {
  if (v === '' || v == null) {
    console.error(`FAIL en.json: empty value for key "${k}"`);
    failed++;
  }
}

for (const lang of ORDER) {
  if (lang === 'en') continue;
  const data = JSON.parse(readFileSync(join(DIR, lang + '.json'), 'utf8'));
  const keys = new Set(Object.keys(data));
  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra   = [...keys].filter(k => !enKeys.has(k));
  if (missing.length) warnings.push(`${lang}.json: missing ${missing.length} key(s) (falls back to en) — ${missing.slice(0,3).join(', ')}${missing.length>3?', ...':''}`);
  if (extra.length)   warnings.push(`${lang}.json: ${extra.length} extra key(s) not in en — ${extra.slice(0,3).join(', ')}${extra.length>3?', ...':''}`);
}

if (warnings.length) {
  console.warn('\nTRANSLATION DRIFT:');
  for (const w of warnings) console.warn('  - ' + w);
}

if (failed) {
  console.error(`\nLEXICON_TRANSLATIONS failed: ${failed} hard error(s) in en.json`);
  process.exit(1);
}

console.log(`LEXICON_TRANSLATIONS ok (${ORDER.length} languages, ${enKeys.size} en keys, ${warnings.length} drift warning(s))`);
