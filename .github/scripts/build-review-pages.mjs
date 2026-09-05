#!/usr/bin/env node
/**
 * build-review-pages.mjs
 *
 * For each content/reviews/<slug>.json, writes reviews/<slug>/index.html —
 * a genuine static document, not a copy of the SPA shell. Unlike
 * generate-entry-pages.mjs (which injects meta into index.html and leaves
 * the article body to client-side render), review pages must contain the
 * full article text server-rendered, because these URLs go straight into
 * a press accreditation application and cold emails to publicists: the
 * person opening the link decides whether this is a real publication in
 * about four seconds, with no guarantee JS ran.
 *
 * So this script does NOT touch index.html or the SPA. It emits a fully
 * self-contained HTML document per review — its own inline <style>, no
 * external stylesheet — so the page is correct even if something else on
 * the site's asset pipeline is broken. Zero dependencies: template
 * literals and node:fs only.
 *
 * Also writes reviews/index.html — the listing page linked as "the
 * publication" — title/dek/rating/date per review, reverse chronological.
 *
 * Run as part of preflight/prebuild, after build-reviews. Idempotent —
 * safe to re-run any time content/reviews/*.json changes.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const REVIEWS = join(ROOT, 'content', 'reviews');
const OUT_DIR = join(ROOT, 'reviews');
const BASE    = 'https://thelexicon.xyz';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Ratings are 0–5 in halves. Render as filled/half/empty star glyphs, e.g.
// 4.5 -> "★★★★½", 3 -> "★★★☆☆".
function stars(rating) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, empty));
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// One shared stylesheet, inlined into every page. Duplicated per file on
// purpose — these are static documents, each one must stand alone.
const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html.dark, html.dark body { background: #0A0A0A; color: #F4F4F5; }
  body {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  a { color: #CCFF00; text-decoration: none; }
  a:hover, a:focus-visible { text-decoration: underline; }
  .site-header, .site-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px clamp(16px, 4vw, 48px);
    border-bottom: 2px solid #CCFF00;
    font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase;
  }
  .site-footer { border-bottom: none; border-top: 1px solid rgba(255,255,255,0.2); gap: 24px; flex-wrap: wrap; }
  .wordmark { font-weight: 700; letter-spacing: 0.1em; }
  main, article { max-width: 720px; margin: 0 auto; padding: clamp(24px, 5vw, 64px) clamp(16px, 4vw, 48px) 80px; }
  .eyebrow {
    font-size: 0.75rem; letter-spacing: 0.22em; text-transform: uppercase;
    color: #CCFF00; margin-bottom: 12px;
  }
  h1 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(2rem, 1.2rem + 3vw, 3.5rem);
    line-height: 1.05; letter-spacing: -0.01em; margin-bottom: 20px;
  }
  p.dek {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(1.1rem, 1rem + 0.5vw, 1.4rem);
    color: #d4d4d4; margin-bottom: 24px;
  }
  .review-meta {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 16px;
    font-size: 0.8rem; letter-spacing: 0.04em;
    padding-bottom: 24px; margin-bottom: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
  }
  .rating { color: #CCFF00; font-size: 1.1rem; letter-spacing: 0.08em; }
  .byline { text-transform: uppercase; letter-spacing: 0.1em; color: #999; }
  time { color: #999; }
  dl.credits {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px 24px;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 20px; margin-bottom: 40px;
    font-size: 0.78rem;
  }
  dl.credits dt { color: #999; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.68rem; margin-bottom: 2px; }
  dl.credits dd { color: #F4F4F5; }
  .review-body {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(1.05rem, 1rem + 0.2vw, 1.2rem);
  }
  .review-body p { margin-bottom: 22px; }
  .review-body h2 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: #CCFF00; margin: 48px 0 20px; padding-bottom: 8px;
    border-bottom: 2px solid #CCFF00;
  }
  blockquote.pullquote {
    font-size: clamp(1.3rem, 1.1rem + 0.8vw, 1.7rem);
    line-height: 1.3; border-left: 3px solid #CCFF00;
    padding: 4px 0 4px 24px; margin: 40px 0; color: #fff;
  }
  figure { margin: 40px 0; border: 1px solid rgba(255,255,255,0.2); }
  figure img { display: block; width: 100%; height: auto; background: #111; }
  figcaption { padding: 12px 16px; font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; line-height: 1.5; color: #999; }
  figcaption .credit { display: block; margin-top: 4px; color: #666; }
  section.works-cited, section.related {
    margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.2);
    font-size: 0.85rem;
  }
  section.works-cited h2, section.related h2 {
    font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: #999; margin-bottom: 12px;
  }
  section.works-cited li, section.related li { list-style: none; margin-bottom: 8px; }
  .review-body strong { color: #fff; }
  .review-body em { font-style: italic; }
  @media (prefers-color-scheme: light) {
    /* Reviews are always dark-themed regardless of system preference — the
       house style is dark by default (see boot.js), and these are
       standalone documents with no JS to reconcile a light toggle. */
  }
`;

function renderBody(review) {
  const imagesById = Object.fromEntries((review.images || []).map(i => [i.id, i]));
  return review.body.map(block => {
    if (block.type === 'p') return `<p>${block.text}</p>`;
    if (block.type === 'h2') return `<h2>${esc(block.text)}</h2>`;
    if (block.type === 'pullquote') return `<blockquote class="pullquote"><p>${block.text}</p></blockquote>`;
    if (block.type === 'image') {
      const img = imagesById[block.ref];
      if (!img) throw new Error(`review "${review.slug}": body image ref "${block.ref}" has no matching images[].id`);
      const captionParts = [esc(img.caption || ''), `<span class="credit">${esc(img.credit)}</span>`].filter(Boolean);
      return `<figure>
        <img src="/${img.src}" alt="${esc(img.alt || '')}" loading="lazy">
        <figcaption>${captionParts.join('')}</figcaption>
      </figure>`;
    }
    return '';
  }).join('\n    ');
}

function renderCredits(film) {
  const rows = [
    ['Director', film.director],
    ['Year', film.year],
    ['Runtime', film.runtimeMinutes ? `${film.runtimeMinutes} min` : null],
    ['Costume design', film.costumeDesigner],
    ['Cinematography', film.cinematographer],
    ['Music', film.composer],
    ['Distributor', film.distributor],
  ].filter(([, v]) => v);
  return `<dl class="credits">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

function buildReviewJsonLd(review, url, ogImage) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    url,
    headline: review.title,
    name: review.title,
    description: review.dek,
    itemReviewed: {
      '@type': 'Movie',
      name: review.title,
      director: { '@type': 'Person', name: review.film.director },
      dateCreated: String(review.film.year),
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 0,
    },
    author: { '@type': 'Person', name: review.byline },
    datePublished: review.publishedAt,
    dateModified: review.updatedAt || review.publishedAt,
    publisher: {
      '@type': 'Organization',
      name: 'THE LEXICON',
      url: BASE,
    },
  };
  if (ogImage) obj.image = [ogImage];
  return JSON.stringify(obj);
}

function renderPage(review) {
  const url       = `${BASE}/reviews/${review.slug}/`;
  const firstImage = (review.images || [])[0];
  const ogImage   = firstImage ? `${BASE}/${firstImage.src}` : null;
  const pageTitle = `${review.title} — review — THE LEXICON`;

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(review.dek)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(review.title)}">
<meta property="og:description" content="${esc(review.dek)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="THE LEXICON">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(review.title)}">
<meta name="twitter:description" content="${esc(review.dek)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">\n` : ''}<link rel="icon" href="/favicon.svg">
<script type="application/ld+json">${buildReviewJsonLd(review, url, ogImage)}</script>
<style>${CSS}</style>
</head>
<body>
  <header class="site-header">
    <a href="/" class="wordmark">THE LEXICON</a>
    <nav><a href="/reviews/">REVIEWS</a></nav>
  </header>

  <main>
    <article>
      <div class="eyebrow">Film review</div>
      <h1>${esc(review.title)}</h1>
      <p class="dek">${esc(review.dek)}</p>

      <div class="review-meta">
        <span class="rating" aria-label="Rating: ${review.rating} out of 5 stars">${stars(review.rating)}</span>
        <span class="byline">${esc(review.byline)}</span>
        <time datetime="${esc(review.publishedAt)}">${formatDate(review.publishedAt)}</time>
      </div>

      ${renderCredits(review.film)}

      <div class="review-body">
        ${renderBody(review)}
      </div>
${review.worksCited?.length ? `
      <section class="works-cited">
        <h2>Works cited</h2>
        <ul>${review.worksCited.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      </section>` : ''}
${review.relatedEntries?.length ? `
      <section class="related">
        <h2>Related in the archive</h2>
        <ul>${review.relatedEntries.map(slug => `<li><a href="/entry/${esc(slug)}/0">${esc(slug)} &rarr;</a></li>`).join('')}</ul>
      </section>` : ''}
    </article>
  </main>

  <footer class="site-footer">
    <a href="/">&larr; THE LEXICON</a>
    <a href="/reviews/">All reviews</a>
    <a href="/press/">Press</a>
  </footer>
</body>
</html>
`;
}

// --- run ---

const files = readdirSync(REVIEWS).filter(f => f.endsWith('.json') && !f.startsWith('_'));

let count = 0;
for (const f of files) {
  const review = JSON.parse(readFileSync(join(REVIEWS, f), 'utf8'));
  const dir = join(OUT_DIR, review.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), renderPage(review), 'utf8');
  count++;
}

console.log(`LEXICON_REVIEW_PAGES ok — wrote ${count} static review page(s) to /reviews/`);
