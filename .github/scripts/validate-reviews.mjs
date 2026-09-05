#!/usr/bin/env node
/**
 * Zero-dependency JSON-schema validator for content/reviews/*.json.
 *
 * Same interpreter as validate-entries.mjs (kept as a separate copy on
 * purpose — these scripts are meant to be simple and resumable in
 * isolation, not coupled through a shared module). Supports the subset of
 * JSON Schema that content/review.schema.json uses: type, required,
 * properties, additionalProperties, items, minItems, minLength, minimum,
 * maximum, pattern, enum, $ref (intra-file only).
 *
 * Beyond generic schema shape, this also enforces invariants the schema
 * can't express on its own — including the legal one: every image must
 * carry a non-empty credit and a valid rights value, because the
 * fair-dealing exception (s.30 CDPA 1988) this site relies on for film
 * stills depends on sufficient acknowledgement. That check is on the
 * JSON content alone (credit string present, rights in the enum) — it
 * doesn't depend on the image file actually existing on disk, so it runs
 * at full strength unconditionally, everywhere, always.
 *
 * The *file-existence* check is a different story, and deliberately
 * separated from the legal one: this script's default invocation is the
 * last step of `npm run check`, which is the last step of `preflight`,
 * which is Vercel's buildCommand. A hard failure there doesn't just skip
 * one review page — it fails the *entire deployment*, taking the whole
 * site down over one review's not-yet-sourced stills. So by default,
 * a missing images[].src file only WARNS (same treatment check-assets.mjs
 * already gives entries, for the same reason). Pass --strict-assets to
 * make it a hard failure — that flag is used by the separate
 * .github/workflows/check.yml CI job, which blocks a PR's merge status
 * without ever touching what Vercel deploys. That's where "enforced in
 * CI, not by discipline" actually lives for this specific check.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT           = fileURLToPath(new URL('../../', import.meta.url));
const REVIEWS        = join(ROOT, 'content', 'reviews');
const ENTRIES        = join(ROOT, 'content', 'entries');
const SCHEMA         = JSON.parse(readFileSync(join(ROOT, 'content', 'review.schema.json'), 'utf8'));
const STRICT_ASSETS  = process.argv.includes('--strict-assets');

function resolveRef(ref, root) {
  // only support intra-document refs like "#/$defs/image"
  if (!ref.startsWith('#/')) throw new Error('unsupported $ref: ' + ref);
  return ref.slice(2).split('/').reduce((acc, k) => acc?.[k], root);
}

function validate(data, schema, path = '$', root = schema) {
  const errs = [];
  if (schema.$ref) schema = resolveRef(schema.$ref, root);

  if (schema.type) {
    const actual = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    const expected = schema.type === 'integer' ? 'number' : schema.type;
    if (actual !== expected || (schema.type === 'integer' && !Number.isInteger(data))) {
      errs.push(`${path}: expected ${schema.type}, got ${actual}`);
      return errs; // bail early — type mismatch makes deeper checks noisy
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errs.push(`${path}: ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }

  if (typeof data === 'string') {
    if (schema.minLength != null && data.length < schema.minLength) {
      errs.push(`${path}: string length ${data.length} < minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errs.push(`${path}: string does not match pattern /${schema.pattern}/`);
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum != null && data < schema.minimum) errs.push(`${path}: ${data} < minimum ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) errs.push(`${path}: ${data} > maximum ${schema.maximum}`);
  }

  if (Array.isArray(data) && schema.items) {
    if (schema.minItems != null && data.length < schema.minItems) {
      errs.push(`${path}: array length ${data.length} < minItems ${schema.minItems}`);
    }
    data.forEach((item, i) => errs.push(...validate(item, schema.items, `${path}[${i}]`, root)));
  }

  if (schema.type === 'object' && data && typeof data === 'object') {
    for (const req of schema.required || []) {
      if (!(req in data)) errs.push(`${path}: missing required property "${req}"`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(data)) {
        if (!(k in schema.properties)) errs.push(`${path}: unexpected property "${k}"`);
      }
    }
    if (schema.properties) {
      for (const [k, subSchema] of Object.entries(schema.properties)) {
        if (k in data) errs.push(...validate(data[k], subSchema, `${path}.${k}`, root));
      }
    }
  }

  return errs;
}

// --- extra invariants the generic schema interpreter can't express ---

function checkInvariants(review, id) {
  const errs = [];

  if (review.slug !== id) errs.push(`$.slug: "${review.slug}" must equal filename "${id}"`);

  // rating must be a multiple of 0.5 (schema only checks the 0–5 range)
  if (typeof review.rating === 'number' && Math.round(review.rating * 2) !== review.rating * 2) {
    errs.push(`$.rating: ${review.rating} is not a multiple of 0.5`);
  }

  // publishedAt must parse and not be in the future
  const published = review.publishedAt ? new Date(review.publishedAt) : null;
  if (!published || Number.isNaN(published.getTime())) {
    errs.push(`$.publishedAt: "${review.publishedAt}" does not parse as a date`);
  } else if (published.getTime() > Date.now()) {
    errs.push(`$.publishedAt: "${review.publishedAt}" is in the future`);
  }

  // every body[] image block's ref must resolve to an images[].id
  const imageIds = new Set((review.images || []).map(img => img.id));
  (review.body || []).forEach((block, i) => {
    if (block.type === 'image') {
      if (!block.ref) errs.push(`$.body[${i}]: type "image" has no ref`);
      else if (!imageIds.has(block.ref)) errs.push(`$.body[${i}]: ref "${block.ref}" does not match any images[].id`);
    } else if (!block.text) {
      errs.push(`$.body[${i}]: type "${block.type}" has no text`);
    }
  });

  // every relatedEntries slug must exist in content/entries/
  for (const slug of review.relatedEntries || []) {
    if (!existsSync(join(ENTRIES, slug + '.json'))) {
      errs.push(`$.relatedEntries: "${slug}" has no matching file in content/entries/`);
    }
  }

  // every image's src should exist on disk — warn by default (deploy-safe,
  // matches check-assets.mjs's treatment of entries), hard fail only with
  // --strict-assets (the dedicated CI job).
  for (const img of review.images || []) {
    const abs = join(ROOT, img.src);
    if (!existsSync(abs)) {
      const msg = `$.images: "${img.src}" (id "${img.id}") does not exist on disk`;
      if (STRICT_ASSETS) errs.push(msg);
      else console.warn(`  WARN ${msg}`);
    }
  }

  return errs;
}

// --- run ---

if (!existsSync(REVIEWS)) {
  console.error('VALIDATE-REVIEWS: no content/reviews/ directory. Skipping.');
  process.exit(0);
}

const files = readdirSync(REVIEWS).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const seenSlugs = new Map();

let failed = 0;
for (const file of files) {
  const id = file.replace(/\.json$/, '');
  const data = JSON.parse(readFileSync(join(REVIEWS, file), 'utf8'));
  const errs = [...validate(data, SCHEMA), ...checkInvariants(data, id)];

  if (data.slug) {
    if (seenSlugs.has(data.slug)) errs.push(`$.slug: "${data.slug}" already used by ${seenSlugs.get(data.slug)}`);
    else seenSlugs.set(data.slug, file);
  }

  if (errs.length) {
    failed++;
    console.error(`\nFAIL ${file}`);
    for (const e of errs) console.error('  - ' + e);
  }
}

if (!STRICT_ASSETS) {
  console.warn('\nMissing image files are warnings in this run (default). Pass --strict-assets (used by CI) to fail on them instead.');
}

if (failed) {
  console.error(`\nLEXICON_VALIDATE_REVIEWS failed: ${failed} review(s) failed validation`);
  process.exit(1);
}
console.log(`LEXICON_VALIDATE_REVIEWS ok (${files.length} reviews)`);
