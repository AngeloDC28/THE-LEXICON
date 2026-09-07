#!/usr/bin/env node
/**
 * build-press-page.mjs
 *
 * Writes press/index.html — a static page for accreditation applications
 * and publicist emails. Copy is drafts/PRESS-COPY.md, used verbatim, with
 * one exception: the archive size ("46 annotated collections") is computed
 * live from content/entries/ rather than hardcoded, because a stale number
 * on the one page a journalist fact-checks against is worse than no number.
 * At the time of writing the actual count was 45, not 46 — this keeps it
 * correct automatically as entries are added.
 *
 * Not driven by content/reviews/*.json, so it lives in its own script
 * rather than build-review-pages.mjs. Same house style (inline CSS, no
 * external stylesheet dependency) as the review pages. Zero dependencies:
 * template literals and node:fs only.
 *
 * Run as part of preflight/prebuild. Output is gitignored — regenerated
 * on every build, same treatment as /entry/ and /reviews/.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');
const OUT_DIR = join(ROOT, 'press');
const BASE    = 'https://thelexicon.xyz';

const entryCount = readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_')).length;

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
  main, article { max-width: 640px; margin: 0 auto; padding: clamp(24px, 5vw, 64px) clamp(16px, 4vw, 48px) 80px; }
  .eyebrow {
    font-size: 0.75rem; letter-spacing: 0.22em; text-transform: uppercase;
    color: #CCFF00; margin-bottom: 12px;
  }
  h1 {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: clamp(2rem, 1.2rem + 3vw, 3rem);
    line-height: 1.1; margin-bottom: 28px;
  }
  h2 {
    font-size: 0.8rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: #CCFF00; margin: 40px 0 14px; padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
  }
  p {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 1.1rem; margin-bottom: 16px; color: #F4F4F5;
  }
  p.lead { font-size: 1.3rem; }
  strong { color: #fff; }
  .links { display: flex; gap: 24px; margin: 24px 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; }
`;

const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Press — THE LEXICON</title>
<meta name="description" content="THE LEXICON is a research archive of dress. Editorial contact, image rights, and press information.">
<link rel="canonical" href="${BASE}/press/">
<meta property="og:type" content="website">
<meta property="og:title" content="Press — THE LEXICON">
<meta property="og:description" content="THE LEXICON is a research archive of dress. Editorial contact, image rights, and press information.">
<meta property="og:url" content="${BASE}/press/">
<meta property="og:site_name" content="THE LEXICON">
<link rel="icon" href="/favicon.svg">
<style>${CSS}</style>
</head>
<body>
  <header class="site-header">
    <a href="/" class="wordmark">THE LEXICON</a>
    <nav><a href="/reviews/">REVIEWS</a></nav>
  </header>

  <main>
    <article>
      <div class="eyebrow">Press</div>
      <h1>Press</h1>

      <p class="lead"><strong>THE LEXICON</strong> is a research archive of dress.</p>

      <p>It annotates landmark runway collections for forensic visual and cultural analysis, and reviews film through costume — the most consistently undervalued craft in cinema.</p>

      <p>Founded 2026. Edited by <strong>Angelo Sanchez Dela Cruz</strong>.</p>

      <div class="links">
        <a href="/reviews/">Reviews</a>
        <a href="/">Archive — ${entryCount} annotated collections and counting</a>
      </div>

      <h2>Contact</h2>
      <p>Editorial and press enquiries: <strong>press@thelexicon.xyz</strong></p>
      <p>Screeners, press screening invitations and interview requests are welcome. We cover costume design, production design and dress on screen, and are particularly interested in speaking to costume designers, cutters and costumiers — the people whose work reaches the audience without their names attached.</p>

      <h2>Images and copyright</h2>
      <p>Film stills reproduced on this site appear under the fair dealing exception for criticism and review, s.30 of the Copyright, Designs and Patents Act 1988, with sufficient acknowledgement. Every still carries its title, director, year and production company.</p>
      <p>Rights holders who would prefer a different image, or a removal, should write to the address above and we will act on it.</p>
      <p>Public domain works are marked as such. Press images supplied by institutions and distributors are credited to the supplying body.</p>
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

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.html'), html, 'utf8');
console.log(`LEXICON_PRESS_PAGE ok — wrote press/index.html (archive count: ${entryCount})`);
