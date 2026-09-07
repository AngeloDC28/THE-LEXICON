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
 * So this script does NOT touch index.html or the SPA. It emits a static
 * HTML document per review with the full article text server-rendered,
 * so the page is correct with no guarantee JS ran.
 *
 * Styling is a separate external stylesheet (reviews/reviews.css), NOT an
 * inline <style> block — the site's CSP is `style-src 'self'` with no
 * 'unsafe-inline', which silently strips inline <style> tags exactly the
 * same way it strips inline style="" attributes. An earlier version of
 * this script inlined the CSS reasoning that it made each page correct
 * "even if the asset pipeline is broken" — that reasoning was backwards:
 * CSP made every review page render completely unstyled from day one.
 * A same-origin <link rel="stylesheet"> is unaffected by style-src 'self'
 * (see /index.css, which the SPA has always used for the same reason).
 *
 * Also writes reviews/index.html — the listing page linked as "the
 * publication" — title/dek/rating/date per review, reverse chronological.
 *
 * Run as part of preflight/prebuild, after build-reviews. Idempotent —
 * safe to re-run any time content/reviews/*.json changes.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const REVIEWS = join(ROOT, 'content', 'reviews');
const OUT_DIR = join(ROOT, 'reviews');
const BASE    = 'https://thelexicon.xyz';

let CSS_VERSION;
try {
  CSS_VERSION = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  CSS_VERSION = Math.floor(Date.now() / 1000).toString(36);
}

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
// Matches index.css's actual signature, not a generic "dark + monospace"
// approximation of it: hard, thick black-on-light or light-on-dark
// borders; flat offset drop-shadows (no blur — see .brutalist-node); loud
// 900-weight uppercase labels; the acid-yellow "tricolour sticky note"
// treatment reused for pull quotes, since a pull quote is exactly the
// kind of loud, single callout that device exists for on the archive.
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
  a:focus-visible { outline: 2px solid #CCFF00; outline-offset: 2px; }
  .site-header, .site-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px clamp(16px, 4vw, 48px);
    border-bottom: 2px solid #CCFF00;
    font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase;
  }
  .site-footer { border-bottom: none; border-top: 2px solid rgba(255,255,255,0.3); gap: 24px; flex-wrap: wrap; }
  .wordmark { font-weight: 700; letter-spacing: 0.1em; }
  main, article { max-width: 720px; margin: 0 auto; padding: clamp(24px, 5vw, 64px) clamp(16px, 4vw, 48px) 80px; }
  .eyebrow {
    font-size: 0.75rem; letter-spacing: 0.22em; text-transform: uppercase;
    color: #CCFF00; margin-bottom: 12px; font-weight: 700;
  }
  h1 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(2rem, 1.2rem + 3vw, 3.5rem);
    line-height: 1.05; letter-spacing: -0.01em; margin-bottom: 20px;
  }
  p.dek {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(1.1rem, 1rem + 0.5vw, 1.4rem);
    color: #d4d4d4; margin-bottom: 28px;
  }
  .review-meta {
    display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
    font-size: 0.8rem; letter-spacing: 0.04em;
    padding-bottom: 24px; margin-bottom: 32px;
    border-bottom: 2px solid rgba(255,255,255,0.3);
  }
  .rating { color: #CCFF00; font-size: 1.1rem; letter-spacing: 0.08em; }
  .byline {
    text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.4); padding: 3px 10px;
  }
  time { color: #999; }
  .draft-flag {
    color: #000; background: #CCFF00; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
    border: 2px solid #000; padding: 3px 10px;
  }

  /* "Note card" treatment — the flat offset shadow is the site's actual
     signature (see .brutalist-node in index.css), not a soft box-shadow. */
  dl.credits {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px 28px;
    background: #F4F4F5; color: #0A0A0A;
    border: 3px solid #000;
    box-shadow: 8px 8px 0 #000;
    padding: 24px; margin: 8px 0 44px;
    font-size: 0.78rem;
  }
  dl.credits dt { color: #555; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; font-size: 0.66rem; margin-bottom: 3px; }
  dl.credits dd { color: #0A0A0A; font-weight: 500; }

  .review-body {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(1.05rem, 1rem + 0.2vw, 1.2rem);
  }
  .review-body p { margin-bottom: 22px; }
  .review-body h2 {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 900;
    font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: #CCFF00; margin: 56px 0 22px; padding-bottom: 10px;
    border-bottom: 3px solid #CCFF00;
  }

  /* Pull quote as tricolour sticky note: bold fill, hard border, flat
     shadow, slight lift on hover — same device as the entry sidebar's
     brutalist notes, reused here because a pull quote IS that device. */
  blockquote.pullquote {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(1.3rem, 1.1rem + 0.8vw, 1.7rem);
    line-height: 1.3; font-weight: 500;
    background: #CCFF00; color: #000;
    border: 3px solid #000;
    box-shadow: 8px 8px 0 #000;
    padding: 28px 32px; margin: 48px 0;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }
  blockquote.pullquote p { margin: 0; }

  figure { margin: 44px 0; border: 2px solid rgba(255,255,255,0.4); background: #000; }
  figure img { display: block; width: 100%; height: auto; background: #111; }
  figcaption {
    padding: 14px 16px; font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem; line-height: 1.5; color: #999;
    border-top: 2px solid rgba(255,255,255,0.4);
  }
  figcaption .credit { display: block; margin-top: 4px; color: #666; }

  section.works-cited, section.related {
    margin-top: 52px; padding-top: 26px; border-top: 2px solid rgba(255,255,255,0.3);
    font-size: 0.85rem;
  }
  section.works-cited h2, section.related h2 {
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #CCFF00; margin-bottom: 14px;
  }
  section.works-cited li, section.related li { list-style: none; margin-bottom: 10px; }
  section.related a {
    display: inline-block; border: 1px solid rgba(255,255,255,0.4);
    padding: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  section.related a:hover { border-color: #CCFF00; text-decoration: none; }

  .review-body strong { color: #fff; font-weight: 700; }
  .review-body em { font-style: italic; }

  .review-list { list-style: none; }
  .review-card { border-bottom: 2px solid rgba(255,255,255,0.3); padding: 36px 0; }
  .review-card:first-child { padding-top: 0; }
  .review-card a:hover h2, .review-card a:focus-visible h2 { color: #CCFF00; }
  .review-card h2 {
    font-family: 'EB Garamond', Georgia, serif; font-size: clamp(1.4rem, 1.1rem + 1.2vw, 2.1rem);
    font-weight: 700;
    color: #F4F4F5; margin: 12px 0 10px; line-height: 1.1; transition: color 0.1s ease;
  }
  .review-card .rating { font-size: 0.85rem; }
  .review-card .dek {
    font-family: 'EB Garamond', Georgia, serif; font-size: 1.05rem; color: #d4d4d4;
  }
  .empty-note {
    color: #0A0A0A; background: #F4F4F5; font-family: 'EB Garamond', Georgia, serif; font-size: 1.1rem;
    border: 3px solid #000; box-shadow: 8px 8px 0 #000; padding: 28px 32px; display: inline-block;
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
    publisher: {
      '@type': 'Organization',
      name: 'THE LEXICON',
      url: BASE,
    },
  };
  // publishedAt/updatedAt are null for an unpublished draft — omit the
  // JSON-LD date fields entirely rather than claim a date that isn't real.
  if (review.publishedAt) {
    obj.datePublished = review.publishedAt;
    obj.dateModified = review.updatedAt || review.publishedAt;
  }
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
<link rel="stylesheet" href="/reviews/reviews.css?v=${CSS_VERSION}">
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
        ${review.publishedAt ? `<time datetime="${esc(review.publishedAt)}">${formatDate(review.publishedAt)}</time>` : `<span class="draft-flag">Unpublished draft</span>`}
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

function renderIndexPage(reviews) {
  const url = `${BASE}/reviews/`;
  const title = 'Reviews — THE LEXICON';
  const desc = 'Film reviewed through costume and dress — the most consistently undervalued craft in cinema.';

  // Listed reviews only include published (dated) ones — an undated draft
  // isn't live editorial yet, even though its static page already exists
  // at its own URL. Order matches build-reviews.mjs: newest first.
  const published = reviews.filter(r => r.publishedAt);

  const cards = published.map(r => `
      <li class="review-card">
        <a href="/reviews/${esc(r.slug)}/">
          <span class="rating" aria-label="Rating: ${r.rating} out of 5 stars">${stars(r.rating)}</span>
          <h2>${esc(r.title)}</h2>
          <p class="dek">${esc(r.dek)}</p>
        </a>
      </li>`).join('\n');

  const itemListLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: published.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/reviews/${r.slug}/`,
      name: r.title,
    })),
  });

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="THE LEXICON">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="icon" href="/favicon.svg">
<script type="application/ld+json">${itemListLd}</script>
<link rel="stylesheet" href="/reviews/reviews.css?v=${CSS_VERSION}">
</head>
<body>
  <header class="site-header">
    <a href="/" class="wordmark">THE LEXICON</a>
    <nav><a href="/reviews/">REVIEWS</a></nav>
  </header>

  <main>
    <article>
      <div class="eyebrow">Reviews</div>
      <h1>Film, through costume</h1>
      <p class="dek">${esc(desc)}</p>

      ${published.length
        ? `<ul class="review-list">${cards}</ul>`
        : `<p class="empty-note">Nothing published yet.</p>`}
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

const reviews = files
  .map(f => JSON.parse(readFileSync(join(REVIEWS, f), 'utf8')))
  .sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return a.slug.localeCompare(b.slug);
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

let count = 0;
for (const review of reviews) {
  const dir = join(OUT_DIR, review.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), renderPage(review), 'utf8');
  count++;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.html'), renderIndexPage(reviews), 'utf8');
writeFileSync(join(OUT_DIR, 'reviews.css'), CSS, 'utf8');

console.log(`LEXICON_REVIEW_PAGES ok — wrote ${count} static review page(s) + reviews/index.html + reviews/reviews.css to /reviews/`);
