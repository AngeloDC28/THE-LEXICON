#!/usr/bin/env node
/**
 * Scaffold a new review in one command. Usage:
 *   npm run new-review <slug>
 *   npm run new-review the-piano
 *
 * Copies content/reviews/_template.json → content/reviews/<slug>.json with
 * the placeholder slug filled in. Refuses to clobber an existing file.
 * Does not touch reviews.js or reviews/ — run `npm run build-reviews`
 * after editing the new JSON.
 *
 * Slug validation matches the review.schema.json pattern: ^[a-z0-9-]+$
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = fileURLToPath(new URL('../../', import.meta.url));
const TEMPLATE = join(ROOT, 'content', 'reviews', '_template.json');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npm run new-review <slug>');
  console.error('Example: npm run new-review the-piano');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`Invalid slug "${slug}". Use lowercase letters, digits, and hyphens only.`);
  process.exit(1);
}

const reviewPath = join(ROOT, 'content', 'reviews', slug + '.json');

if (existsSync(reviewPath)) {
  console.log(`✓ review already exists: content/reviews/${slug}.json`);
  process.exit(0);
}

const tpl = readFileSync(TEMPLATE, 'utf8');
const populated = tpl.replace(/REPLACE-WITH-KEBAB-CASE-SLUG/g, slug);
writeFileSync(reviewPath, populated, 'utf8');
console.log(`✓ created  content/reviews/${slug}.json`);

console.log('');
console.log('Next steps:');
console.log(`  1. Edit content/reviews/${slug}.json: title, dek, rating, film, body, images`);
console.log(`  2. Drop stills into public/THE-LEXICON-ASSETS/reviews/ (credit + rights are required per image)`);
console.log(`  3. npm run build-reviews   # regenerates reviews.js and reviews/${slug}/`);
console.log(`  4. npm run check           # validates before commit`);
