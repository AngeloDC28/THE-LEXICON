#!/usr/bin/env node
/**
 * generate-entry-pages.mjs
 *
 * For each of the 45 entries, writes /entry/{slug}/0/index.html — a full copy
 * of index.html with entry-specific <head> meta (title, description, og:*, twitter:*,
 * canonical). Vercel serves these as static files, so social crawlers (Twitter card
 * validator, Facebook OG debugger, WhatsApp link preview) see unique meta per entry.
 *
 * The SPA still boots normally; the inline boot script in <head> is redundant but
 * harmless. handleRouting() opens the correct entry on load.
 *
 * Run as part of preflight. Generated files are gitignored (/entry/) — Vercel
 * regenerates them on every build. Does NOT require any npm deps.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const BASE    = 'https://thelexicon.xyz';

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


function buildArticleJsonLd(entry, url, ogImage) {
  const title = entry.title || entry.id;
  const desc  = buildDesc(entry);
  const t     = entry.tags || {};
  const keywords = [
    t.brand, t.politics, t.theories, t.era, t.format
  ].filter(Boolean).flatMap(v => v.split(';').map(s => s.trim())).filter(Boolean);

  const images = (entry.images || []).slice(0, 3).map(img =>
    `${BASE}/public/${img.src || ''}`
  ).filter(s => s.length > BASE.length + 1);
  if (!images.length && ogImage) images.push(ogImage);

  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': url + '#article',
    headline: title,
    description: buildDesc(entry),
    image: images,
    author: { '@type': 'Organization', name: 'THE LEXICON', url: BASE },
    publisher: {
      '@type': 'Organization', '@id': BASE + '/#org',
      name: 'THE LEXICON',
      logo: { '@type': 'ImageObject', url: `${BASE}/public/THE-LEXICON-ASSETS/mcqueen-ss99/mcqueen-ss99-01.jpg` }
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    about: keywords.map(k => ({ '@type': 'Thing', name: k })),
    keywords: keywords.join(', '),
    inLanguage: 'en-GB',
    isPartOf: { '@id': BASE + '/#website' }
  };
  if (entry.year) obj.datePublished = `${entry.year}-01-01`;
  return JSON.stringify(obj);
}

function buildDesc(entry) {
  const critique = (entry.notes?.critique || '').slice(0, 200).trimEnd();
  const subtitle = entry.subtitle || '';
  // Don't prepend subtitle if it's already the opening words of the critique
  const needsSubtitle = subtitle && !critique.startsWith(subtitle);
  const parts = [];
  if (needsSubtitle) parts.push(subtitle);
  if (critique) parts.push(critique);
  let d = parts.join('. ');
  if (d.length > 220) d = d.slice(0, 217) + '...';
  return d || `${entry.title} — forensic visual analysis. A landmark collection annotated for visual and cultural research.`;
}

const template = readFileSync(join(ROOT, 'index.html'), 'utf8');

const slugs = readdirSync(ENTRIES)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => f.replace(/\.json$/, ''))
  .sort();

let count = 0;

for (const slug of slugs) {
  const entry = JSON.parse(readFileSync(join(ENTRIES, `${slug}.json`), 'utf8'));

  const title    = entry.title || slug;
  const desc     = buildDesc(entry);
  const url      = `${BASE}/entry/${slug}/0`;
  const imgSrc   = entry.images?.[0]?.src || '';
  const ogImage  = imgSrc
    ? `${BASE}/public/${imgSrc}`
    : `${BASE}/public/THE-LEXICON-ASSETS/mcqueen-ss99/mcqueen-ss99-01.jpg`;
  const imgAlt   = `${title} — THE LEXICON`;

  let html = template;

  // <title>
  html = html.replace(
    /<title>THE LEXICON[^<]*<\/title>/,
    `<title>${escAttr(title)} — THE LEXICON</title>`
  );

  // meta[name="description"]
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escAttr(desc)}$2`
  );

  // og:title
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escAttr(title)} — THE LEXICON$2`
  );

  // og:description
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${escAttr(desc)}$2`
  );

  // og:type  website → article
  html = html.replace(
    /(<meta property="og:type" content=")website(")/,
    `$1article$2`
  );

  // og:url
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${url}$2`
  );

  // og:image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${ogImage}$2`
  );

  // og:image:alt
  html = html.replace(
    /(<meta property="og:image:alt" content=")[^"]*(")/,
    `$1${escAttr(imgAlt)}$2`
  );

  // twitter:title
  html = html.replace(
    /(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escAttr(title)} — THE LEXICON$2`
  );

  // twitter:description
  html = html.replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escAttr(desc)}$2`
  );

  // twitter:image
  html = html.replace(
    /(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${ogImage}$2`
  );

  // canonical
  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    `$1${url}$2`
  );

  // hreflang — rewrite homepage hrefs to per-entry hrefs, preserving ?lang= params
  // e.g. href="https://thelexicon.xyz/?lang=fr" → href="https://thelexicon.xyz/entry/slug/0?lang=fr"
  html = html.replace(
    /(<link rel="alternate" hreflang="[^"]*" href=")https:\/\/thelexicon\.xyz\/(\?lang=[^"]*)?"/g,
    (_, pre, query) => `${pre}${url}${query || ''}"`
  );

  // Article JSON-LD — populate the empty entry-jsonld placeholder
  html = html.replace(
    /<script id="entry-jsonld" type="application\/ld\+json"><\/script>/,
    `<script id="entry-jsonld" type="application/ld+json">${buildArticleJsonLd(entry, url, ogImage)}</script>`
  );


  const dir = join(ROOT, 'entry', slug, '0');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count++;
}

console.log(`LEXICON_ENTRY_PAGES ok — wrote ${count} static entry pages to /entry/`);
