#!/usr/bin/env node
/**
 * Generate sitemap.xml at the repo root from content/entries/*.json.
 *
 * Reads source JSON files directly (not database.js) so it can run
 * immediately after build-data in the preflight sequence. Entry IDs
 * are derived from filenames (e.g. mcqueen-ss99.json → mcqueen-ss99).
 * Files prefixed with "_" (e.g. _template.json) are skipped.
 *
 * Output: /sitemap.xml committed to the repo root so GitHub Pages
 * serves it at https://thelexicon.xyz/sitemap.xml.
 *
 * URL structure:
 *   Homepage  https://thelexicon.xyz/           priority 1.0, weekly
 *   Entry     https://thelexicon.xyz/entry/{id}/0  priority 0.8, monthly
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const OUT     = join(ROOT, 'sitemap.xml');
const BASE    = 'https://thelexicon.xyz';
const TODAY   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const ids = readdirSync(ENTRIES)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => f.replace(/\.json$/, ''))
  .sort();

const url = (loc, priority, changefreq) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const urls = [
  url(`${BASE}/`, '1.0', 'weekly'),
  ...ids.map(id => url(`${BASE}/entry/${id}/0`, '0.8', 'monthly')),
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.join('\n') + '\n' +
  `</urlset>\n`;

writeFileSync(OUT, xml, 'utf8');
console.log(`LEXICON_SITEMAP ok (wrote ${OUT} — 1 homepage + ${ids.length} entries)`);
