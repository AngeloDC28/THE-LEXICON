#!/usr/bin/env node
/**
 * Generate /feed.xml (RSS 2.0) from content/entries/*.json ordered by
 * content/order.json. Runs as part of preflight after build-data.
 *
 * Output: /feed.xml committed to the repo root, served at
 * https://thelexicon.xyz/feed.xml
 *
 * Items: all entries in display order, newest first (order.json is
 * curated, not chronological, so we preserve that order and let
 * feed readers show the list as the editor intended).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const ORDER   = join(ROOT, 'content', 'order.json');
const OUT     = join(ROOT, 'feed.xml');
const BASE    = 'https://thelexicon.xyz';
const BUILT   = new Date().toUTCString();

const order = JSON.parse(readFileSync(ORDER, 'utf8'));

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const items = order.map(id => {
  let entry;
  try { entry = JSON.parse(readFileSync(join(ENTRIES, `${id}.json`), 'utf8')); }
  catch { return null; }

  const title   = entry.title || `${entry.brand || id} ${entry.season || ''} ${entry.year || ''}`.trim();
  const url     = `${BASE}/entry/${id}/0`;
  const img     = entry.images?.[0]?.src
    ? `${BASE}/public/${entry.images[0].src}`
    : null;
  const desc    = entry.subtitle
    || entry.notes?.critique?.slice(0, 200)
    || `Forensic visual analysis of ${title}.`;
  const imgTag  = img ? `<enclosure url="${esc(img)}" type="image/jpeg" length="0"/>` : '';

  return `  <item>
    <title>${esc(title)} — THE LEXICON</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    <description>${esc(desc)}</description>
    ${imgTag}
  </item>`;
}).filter(Boolean);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>THE LEXICON</title>
    <link>${BASE}/</link>
    <description>A research archive mapping fashion history, visual culture, and the lineage of ideas. 45 landmark collections annotated by analytical category, designer, era, and movement.</description>
    <language>en-gb</language>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${BUILT}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(`LEXICON_FEED ok (wrote ${OUT} — ${items.length} entries)`);
