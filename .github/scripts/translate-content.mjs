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

const BATCH_SIZE = 15;
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// gemini-2.5-flash-lite is the right default for bulk translation: free tier
// allows ~1000 RPD instead of ~20 RPD on gemini-2.5-flash. Quality is slightly
// lower but adequate for short editorial strings; the tightened prompt +
// markdown-stripping parser absorb the verbose output style.
// Override with GEMINI_MODEL env var if you want the full model (slower passes,
// stricter daily cap, marginally better nuance on long descriptions).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
// Free tier rate limit: 15 RPM = wait 4.2s between requests. Leave headroom.
const GEMINI_INTER_REQUEST_DELAY_MS = 4500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function buildPrompt(keys, langName) {
  const numbered = keys.map((k, i) => `${i+1}. ${k}`).join('\n');
  return `Translate the following English strings from a fashion archive UI (entry titles, ` +
         `hotspot labels, critical essays, taxonomy values) into ${langName}.\n\n` +
         `OUTPUT RULES — follow exactly:\n` +
         `- One translation per input. Prefix each line with the matching input number followed ` +
         `by a period and a space, like:  1. <translation>  then  2. <translation>  etc.\n` +
         `- No introductions, no explanations, no markdown bolds (no asterisks), no notes.\n` +
         `- Preserve designer/brand names, technical fabric names, and academic theorist names ` +
         `(Foucault, Barthes, Bourdieu, etc.) when industry usage keeps them in their original form.\n` +
         `- Preserve in-line citation markers like [cite: 3] verbatim.\n` +
         `- Output exactly ${keys.length} numbered lines, in order, no more, no less.\n\n` +
         `INPUT:\n${numbered}`;
}

function parseNumberedResponse(text, keys) {
  const out = {};
  // Accept "1. translation", "1) translation", and the occasional "N. 1. translation"
  // / "N. 1) translation" the model emits when it gets confused by templates.
  const lineRe = /^\s*(?:N\.\s*)?(\d+)[.)]\s*(.+?)\s*$/;
  for (const line of text.split(/\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const i = parseInt(m[1], 10) - 1;
    if (!keys[i]) continue;
    let val = m[2].replace(/^\*\*(.+)\*\*$/, '$1').replace(/^["“'](.+)["”']$/, '$1').trim();
    if (val) out[keys[i]] = val;
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
      generationConfig: { maxOutputTokens: 32000, temperature: 0.2 }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error(`Gemini quota hit (429). Wait, then re-run. Body: ${err}`);
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const finish = json.candidates?.[0]?.finishReason || '';
  const parsed = parseNumberedResponse(text, keys);
  // If parsing dropped most of the batch, surface a snippet so we can diagnose
  if (Object.keys(parsed).length < keys.length / 2) {
    const snippet = (text || '<empty>').slice(0, 400).replace(/\n/g, ' ⏎ ');
    console.warn(`    LOW-YIELD batch (${Object.keys(parsed).length}/${keys.length}, finishReason=${finish}). Snippet: ${snippet}`);
  }
  return parsed;
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
