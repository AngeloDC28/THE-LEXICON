#!/usr/bin/env node
/**
 * Fill missing translation keys in content/translations/<lang>.json using a
 * free or paid LLM API. For every key present in en.json but absent (or empty)
 * in a target language file, ask the model to translate it and write the result.
 *
 * Two providers supported, auto-detected by which API key is set:
 *
 *   GEMINI_API_KEY     → Google Gemini 2.0 Flash (FREE, recommended)
 *                        Get a key at https://aistudio.google.com/app/apikey
 *                        Free tier: 1500 requests/day, 15 requests/minute, no
 *                        credit card required. Covers all 600+ keys × 10 langs
 *                        with room to spare (we batch 30 per request → ~200
 *                        requests total).
 *
 *   ANTHROPIC_API_KEY  → Claude Haiku 4.5 (paid, ~$2-5 one-time for full pass)
 *                        Get a key at https://console.anthropic.com/
 *
 * Idempotent: existing translations are never overwritten. Resumable: if the
 * script dies mid-batch, re-run it and it picks up where it left off because
 * already-translated keys are now present.
 *
 * Usage:
 *   GEMINI_API_KEY=AIza... node .github/scripts/translate-content.mjs              # all langs
 *   GEMINI_API_KEY=AIza... node .github/scripts/translate-content.mjs fr es        # just these
 *   node .github/scripts/translate-content.mjs --dry-run                           # no API calls
 *
 * Force a specific provider (when both keys are present):
 *   TRANSLATE_PROVIDER=gemini    GEMINI_API_KEY=... node .github/scripts/translate-content.mjs
 *   TRANSLATE_PROVIDER=anthropic ANTHROPIC_API_KEY=... node .github/scripts/translate-content.mjs
 *
 * Run npm run sync-content-keys FIRST so en.json reflects current entries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = fileURLToPath(new URL('../../', import.meta.url));
const DIR   = join(ROOT, 'content', 'translations');
const ORDER = JSON.parse(readFileSync(join(DIR, '_order.json'), 'utf8'));
const en    = JSON.parse(readFileSync(join(DIR, 'en.json'), 'utf8'));

const args   = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const langs  = args.filter(a => !a.startsWith('--'));
const targets = (langs.length ? langs : ORDER).filter(l => l !== 'en');

const explicit = process.env.TRANSLATE_PROVIDER;
const geminiKey    = process.env.GEMINI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
let provider, apiKey;
if (explicit === 'gemini')         { provider = 'gemini';    apiKey = geminiKey; }
else if (explicit === 'anthropic') { provider = 'anthropic'; apiKey = anthropicKey; }
else if (geminiKey)                { provider = 'gemini';    apiKey = geminiKey; }
else if (anthropicKey)             { provider = 'anthropic'; apiKey = anthropicKey; }

if (!apiKey && !dryRun) {
  console.error('No API key set. Either:');
  console.error('  GEMINI_API_KEY=... npm run translate-content     # FREE, sign up at https://aistudio.google.com/app/apikey');
  console.error('  ANTHROPIC_API_KEY=... npm run translate-content  # paid, ~$2-5');
  console.error('Or pass --dry-run to preview without calling any API.');
  process.exit(1);
}
if (provider && !dryRun) console.log(`Using provider: ${provider}`);

const LANG_NAMES = {
  'en-gb': 'British English', 'en-us': 'American English',
  fr: 'French', es: 'Spanish', it: 'Italian', de: 'German',
  pt: 'Portuguese', ru: 'Russian', zh: 'Simplified Chinese',
  ja: 'Japanese', ko: 'Korean'
};

const BATCH_SIZE = 30;
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const GEMINI_MODEL    = 'gemini-2.0-flash';
// Free tier rate limit: 15 RPM = wait 4.2s between requests. Leave headroom.
const GEMINI_INTER_REQUEST_DELAY_MS = 4500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function buildPrompt(keys, langName) {
  const numbered = keys.map((k, i) => `${i+1}. ${k}`).join('\n');
  return `Translate the following English fashion/art-criticism strings to ${langName}. ` +
         `These appear in a fashion archive UI (entry titles, hotspot labels, critical essays). ` +
         `Preserve specialised terms (designer names, brand names, technical fabric names) when ` +
         `they would be untranslated in industry usage. Keep the same numbered format. ` +
         `Output ONLY the numbered translations, nothing else.\n\n${numbered}`;
}

function parseNumberedResponse(text, keys) {
  const out = {};
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

async function translateBatchAnthropic(keys, langName) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: buildPrompt(keys, langName) }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return parseNumberedResponse(json.content?.[0]?.text || '', keys);
}

async function translateBatchGemini(keys, langName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(keys, langName) }] }],
      generationConfig: { maxOutputTokens: 8000, temperature: 0.2 }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    // 429 → quota exhausted. Surface a clear message.
    if (res.status === 429) throw new Error(`Gemini quota hit (429). Wait a minute, or until the daily quota resets, then re-run. Body: ${err}`);
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return parseNumberedResponse(text, keys);
}

async function translateBatch(keys, langName) {
  if (provider === 'gemini') return translateBatchGemini(keys, langName);
  return translateBatchAnthropic(keys, langName);
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
    // Free-tier Gemini caps at 15 RPM. Sleep between requests so we don't 429.
    if (provider === 'gemini' && i + BATCH_SIZE < missing.length) {
      await sleep(GEMINI_INTER_REQUEST_DELAY_MS);
    }
  }
  console.log(`[${lang}] done (${Object.keys(data).length} keys total)`);
}
