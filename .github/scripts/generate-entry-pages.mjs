#!/usr/bin/env node
/**
 * generate-entry-pages.mjs
 *
 * For each of the 45 entries, writes /entry/{slug}/index.html — a full copy
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
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTagCategory, categoryLabel, categoryPlain, safeCover } from '../../js/modules/categories.js';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const BASE    = 'https://thelexicon.xyz';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (s) => String(s ?? '')
  .replace(/\[cite:\s*\d+\]/g, '').replace(/--/g, '—').replace(/\s+/g, ' ').trim();
const thumb = (src) => `/public/${src.replace(/\.(jpe?g|png|webp)$/i, '.t480.webp')}`;

const SPEC_FIELDS = [
  ['era', 'Era'], ['politics', 'Politics'], ['theories', 'Theories'], ['anatomy', 'Form & anatomy'],
  ['materials', 'Materials'], ['geography', 'Geography'], ['gender', 'Gender'], ['format', 'Format & medium'],
];
const NOTE_FIELDS = [['provenance', 'Provenance'], ['critique', 'Critique'], ['strategy', 'Strategy']];

/**
 * The whole entry as a plain HTML article, so the page is complete without
 * JavaScript: search engines, link unfurlers, reader modes and people with
 * JS off all get the real content instead of the homepage. boot.js adds
 * html.js before first paint and index.css hides .static-entry under it, so
 * the interactive view is unchanged for everyone else.
 */
const SEASONS = { SS: 'Spring/Summer', AW: 'Autumn/Winter' };

function buildStaticArticle(entry) {
  const t = entry.tags || {};
  const cat = getTagCategory(t.politics || '');
  const notes = NOTE_FIELDS
    .filter(([k]) => entry.notes?.[k])
    .map(([k, label]) => `<section><h2>${label}</h2><p>${esc(clean(entry.notes[k]))}</p></section>`)
    .join('');
  const looks = (entry.images || []).map((img, i) => {
    const spots = (img.hotspots || []);
    const alt = `${entry.title}, look ${i + 1} of ${entry.images.length}${spots.length ? ': ' + spots.map(h => h.label).join(', ') : ''}`;
    const list = spots.length
      ? `<dl>${spots.map(h => `<dt>${esc(h.label)}</dt><dd>${esc(clean(h.description))}</dd>`).join('')}</dl>`
      : '';
    if (img.content_note) return `<figure><p class="static-entry-note">Look ${i + 1} not shown here. Content note: ${esc(img.content_note)}.</p>${list}</figure>`;
    return `<figure><img src="${esc(thumb(img.src))}" alt="${esc(alt)}" width="480" loading="lazy" decoding="async"><figcaption>Look ${i + 1}</figcaption>${list}</figure>`;
  }).join('');
  const specs = SPEC_FIELDS
    .filter(([k]) => t[k])
    .map(([k, label]) => `<dt>${label}</dt><dd>${esc(t[k].split('|').map(s => s.trim()).join(', '))}</dd>`)
    .join('');
  const sources = (entry.sources || []).map(s => {
    const title = s.type === 'book' || s.type === 'catalogue' ? `<cite>${esc(s.title)}</cite>` : `“${esc(s.title)}”`;
    const parts = [s.author && esc(s.author), title, s.publication && esc(s.publication), s.date && esc(s.date)].filter(Boolean).join(', ');
    return `<li>${s.url ? `<a href="${esc(s.url)}" rel="noopener">${parts}</a>` : parts}.</li>`;
  }).join('');
  const credit = entry.photo_credit
    ? `Photographs: ${esc(entry.photo_credit)}${entry.image_source?.url ? `, via <a href="${esc(entry.image_source.url)}">${esc(entry.image_source.name)}</a>` : ''}.`
    : 'Photographer credit being confirmed.';
  return `
  <article class="static-entry" aria-labelledby="static-entry-title">
    <p class="static-entry-nav"><a href="/">THE LEXICON</a> / <span>${esc(categoryPlain(cat))}</span></p>
    <h1 id="static-entry-title">${esc(entry.title)}${entry.subtitle ? `<span class="static-entry-sub">${esc(entry.subtitle)}</span>` : ''}</h1>
    <p class="static-entry-meta">${esc(t.brand || '')} · ${esc(SEASONS[entry.season] || entry.season || '')} ${esc(entry.year || '')} · ${esc(categoryPlain(cat))} (${esc(categoryLabel(cat))})</p>
    ${entry.summary_plain ? `<p class="static-entry-summary">${esc(entry.summary_plain)}</p>` : ''}
    ${notes}
    <section><h2>Looks</h2>${looks}<p class="static-entry-credit">${credit} Reproduced for criticism and review under CDPA 1988 s.30.</p></section>
    ${specs ? `<section><h2>Quick facts</h2><dl class="static-entry-specs">${specs}</dl></section>` : ''}
    ${sources ? `<section><h2>Sources</h2><ol>${sources}</ol></section>` : ''}
    <p class="static-entry-nav"><a href="/">← All 45 collections</a></p>
  </article>`;
}

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

  const images = (entry.images || []).filter(img => !img.content_note).slice(0, 3).map(img =>
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
  // The plain summary is what a friend sees when the link is shared.
  if (entry.summary_plain) return entry.summary_plain;
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

// Start clean so pages for renamed entries (or the old /entry/{slug}/0/
// layout) never linger in the deploy.
rmSync(join(ROOT, 'entry'), { recursive: true, force: true });

const slugs = readdirSync(ENTRIES)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => f.replace(/\.json$/, ''))
  .sort();

let count = 0;

for (const slug of slugs) {
  const entry = JSON.parse(readFileSync(join(ENTRIES, `${slug}.json`), 'utf8'));

  const title    = entry.title || slug;
  const desc     = buildDesc(entry);
  const url      = `${BASE}/entry/${slug}`;
  // Link previews never show a look that carries a content note.
  const imgSrc   = (entry.images || []).find(img => !img.content_note)?.src || '';
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
  // e.g. href="https://thelexicon.xyz/?lang=fr" → href="https://thelexicon.xyz/entry/slug?lang=fr"
  html = html.replace(
    /(<link rel="alternate" hreflang="[^"]*" href=")https:\/\/thelexicon\.xyz\/(\?lang=[^"]*)?"/g,
    (_, pre, query) => `${pre}${url}${query || ''}"`
  );

  // Article JSON-LD — populate the empty entry-jsonld placeholder
  html = html.replace(
    /<script id="entry-jsonld" type="application\/ld\+json"><\/script>/,
    `<script id="entry-jsonld" type="application/ld+json">${buildArticleJsonLd(entry, url, ogImage)}</script>`
  );


  // Full entry content, readable without JavaScript (hidden under html.js).
  html = html.replace(/<body>/, `<body>${buildStaticArticle(entry)}`);

  const dir = join(ROOT, 'entry', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count++;
}

console.log(`LEXICON_ENTRY_PAGES ok — wrote ${count} static entry pages to /entry/`);
