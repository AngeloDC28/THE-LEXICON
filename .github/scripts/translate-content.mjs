#!/usr/bin/env node
/**
 * Fill missing translation keys in content/translations/<lang>.json using the
 * Anthropic API. For every key present in en.json but absent (or empty) in a
 * target language file, ask Claude to translate it and write the result.
 *
 * Idempotent: existing translations are never overwritten. Resumable: if the
 * script dies mid-batch, re-run it and it picks up where it left off because
 * already-translated keys are now present.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node .github/scripts/translate-content.mjs              # all languages
 *   ANTHROPIC_API_KEY=sk-ant-... node .github/scripts/translate-content.mjs fr es        # just these
 *   ANTHROPIC_API_KEY=sk-ant-... node .github/scripts/translate-content.mjs --dry-run    # show what would translate
 *
 * Notes:
 * - Uses claude-haiku-4-5-20251001 for cost (these are short-form translations).
 * - Batches up to 30 keys per request (titles/labels short, descriptions longer).
 * - Skips keys whose ENGLISH content is just a brand/proper noun (we keep brands as-is
 *   across languages — getTranslation falls back to English which is exactly what we want).
 * - Run npm run sync-content-keys FIRST so en.json reflects current entries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = fileURLToPath(new URL('../../', import.meta.url));
const DIR   = join(ROOT, 'content', 'translations');
const ORDER = JSON.parse(readFileSync(join(DIR, '_order.json'), 'utf8'));
const en    = JSON.parse(readFileSync(join(DIR, 'en.json'), 'utf8'));

const apiKey = process.env.ANTHROPIC_API_KEY;
const args   = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const langs  = args.filter(a => !a.startsWith('--'));
const targets = (langs.length ? langs : ORDER).filter(l => l !== 'en');

if (!apiKey && !dryRun) {
  console.error('ANTHROPIC_API_KEY not set. Set it or pass --dry-run.');
  process.exit(1);
}

const LANG_NAMES = {
  'en-gb': 'British English', 'en-us': 'American English',
  fr: 'French', es: 'Spanish', it: 'Italian', de: 'German',
  pt: 'Portuguese', ru: 'Russian', zh: 'Simplified Chinese',
  ja: 'Japanese', ko: 'Korean'
};

const BATCH_SIZE = 30;
const MODEL      = 'claude-haiku-4-5-20251001';

async function translateBatch(keys, langName) {
  const numbered = keys.map((k, i) => `${i+1}. ${k}`).join('\n');
  const body = {
    model: MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Translate the following English fashion/art-criticism strings to ${langName}. ` +
               `These appear in a fashion archive UI (entry titles, hotspot labels, critical essays). ` +
               `Preserve specialised terms (designer names, brand names, technical fabric names) when ` +
               `they would be untranslated in industry usage. Keep the same numbered format. ` +
               `Output ONLY the numbered translations, nothing else.\n\n${numbered}`
    }]
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }
  const json = await res.json();
  const text = json.content?.[0]?.text || '';
  const out = {};
  // Parse `1. translation`, `2. translation`, ...
  const lines = text.split(/\n/);
  for (const line of lines) {
    const m = line.match(/^(\d+)\.\s*(.+)$/);
    if (m) {
      const i = parseInt(m[1], 10) - 1;
      if (keys[i]) out[keys[i]] = m[2].trim();
    }
  }
  return out;
}

for (const lang of targets) {
  const path = join(DIR, lang + '.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const langName = LANG_NAMES[lang] || lang;

  const missing = Object.keys(en).filter(k => !(k in data) || !data[k]);
  if (!missing.length) {
    console.log(`[${lang}] already complete (${Object.keys(data).length} keys)`);
    continue;
  }

  console.log(`[${lang}] ${missing.length} missing keys` + (dryRun ? ' (dry-run, no API calls)' : ''));
  if (dryRun) continue;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(missing.length/BATCH_SIZE)} (${batch.length} keys)... `);
    try {
      const translations = await translateBatch(batch, langName);
      Object.assign(data, translations);
      writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`ok (${Object.keys(translations).length}/${batch.length})`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      console.log(`  partial progress saved; re-run to resume`);
      break;
    }
  }
  console.log(`[${lang}] done (${Object.keys(data).length} keys total)`);
}
