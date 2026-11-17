#!/usr/bin/env node
/**
 * generate-static-pages.mjs
 *
 * Writes the site's supporting pages as real, linkable HTML:
 *
 *   /about/index.html      who makes THE LEXICON and why
 *   /glossary/index.html   every definition, A–Z, from js/modules/glossary-data.js
 *   /privacy/index.html    what is stored, for how long, and a line for under-18s
 *   /terms/index.html      terms of use and the image / fair-dealing statement
 *
 * These used to exist only as pop-ups inside the app, so none of them could
 * be linked to, shared, found by a search engine or read without JavaScript
 * (/glossary, /privacy and /terms returned 404). They are plain documents in
 * sentence case with no app code, styled by /pages.css (an external file:
 * the site's CSP blocks inline styles).
 *
 * Output folders are gitignored, like /entry/: preflight regenerates them and
 * stage-output.mjs copies them into out/. Idempotent, zero dependencies.
 */
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOSSARY, FASHION_BASICS } from '../../js/modules/glossary-data.js';
import { CATEGORY_PLAIN, CATEGORY_LABELS } from '../../js/modules/categories.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'https://thelexicon.xyz';
const UPDATED = '17 November 2026';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const anchor = (term) => term.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const entries = readdirSync(join(ROOT, 'content', 'entries'))
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => JSON.parse(readFileSync(join(ROOT, 'content', 'entries', f), 'utf8')));
const years = entries.map(e => e.year).filter(Boolean);
const SPAN = `${Math.min(...years)}–${Math.max(...years)}`;

function page({ slug, title, description, body }) {
  const url = `${BASE}/${slug}`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} · THE LEXICON</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="THE LEXICON" />
  <meta property="og:title" content="${esc(title)} · THE LEXICON" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" href="/favicon.svg" />
  <link rel="alternate" type="application/rss+xml" title="THE LEXICON" href="/feed.xml" />
  <link rel="stylesheet" href="/pages.css" />
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="bar">
    <a class="logo" href="/">THE LEXICON</a>
    <nav aria-label="Site">
      <a href="/">All shows</a>
      <a href="/glossary"${slug === 'glossary' ? ' aria-current="page"' : ''}>Glossary</a>
      <a href="/about"${slug === 'about' ? ' aria-current="page"' : ''}>About</a>
    </nav>
  </header>
  <main id="main" class="doc">
${body}
  </main>
  <footer class="foot">
    <p>No tracking · No ads · Independent research</p>
    <p><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/feed.xml">RSS feed</a> · <a href="mailto:info@thelexicon.xyz">info@thelexicon.xyz</a></p>
  </footer>
</body>
</html>
`;
}

// ── About ────────────────────────────────────────────────────────────────
const ideas = Object.keys(CATEGORY_PLAIN).map(k =>
  `<li><strong>${esc(CATEGORY_PLAIN[k].title)}</strong> <span class="theory">${esc(CATEGORY_LABELS[k])}</span><br>${esc(CATEGORY_PLAIN[k].blurb)}</li>`).join('\n      ');

const about = page({
  slug: 'about',
  title: 'About',
  description: `THE LEXICON explains ${entries.length} famous fashion shows (${SPAN}): what they meant, where the ideas came from, and what they inspired.`,
  body: `    <p class="eyebrow">About</p>
    <h1>Fashion shows, explained.</h1>
    <p class="lede">THE LEXICON explains ${entries.length} famous fashion shows from ${SPAN}: what happened, why people still talk about them, where the ideas came from and what they went on to inspire.</p>

    <h2>Who makes it</h2>
    <p>THE LEXICON is researched and written by Angelo Sanchez Dela Cruz, a researcher and cultural analyst based in London. It is independent: no brand pays to appear, there are no ads, and nothing you do on the site is tracked.</p>

    <h2>Who it's for</h2>
    <p>Anyone curious about why clothes look the way they do, from a student starting an essay to a designer checking where an idea came from. Every show starts with a short, plain summary; the longer notes underneath go into the detail for people who want it. Stylists, costume teams and critics use it for references that hold up.</p>

    <h2>How each show is written up</h2>
    <ul>
      <li><strong>A plain summary</strong> of what happened and why it matters.</li>
      <li><strong>Notes pinned to the photos</strong>, usually three per look, on what you are looking at.</li>
      <li><strong>Three longer notes:</strong> provenance (what happened), critique (what it means) and strategy (how it was made).</li>
      <li><strong>Sources</strong> for every show, so you can check the facts and cite them.</li>
      <li><strong>Tags</strong> on nine axes (designer, era, politics, theory, gender, materials, place, body and format) that link related shows in the Nexus.</li>
    </ul>

    <h2>The six big ideas</h2>
    <p>Every show is filed under one big idea. The plain name comes first; the theory name underneath is the one used in fashion writing.</p>
    <ul class="ideas">
      ${ideas}
    </ul>

    <h2>Get in touch</h2>
    <p>Spotted a mistake, want to suggest a show, or need a press kit? Email <a href="mailto:info@thelexicon.xyz">info@thelexicon.xyz</a>. For institutional licensing: <a href="mailto:licensing@thelexicon.xyz">licensing@thelexicon.xyz</a>.</p>`,
});

// ── Glossary ─────────────────────────────────────────────────────────────
const dl = (obj) => Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
  .map(([term, def]) => `      <div class="term" id="${anchor(term)}"><dt>${esc(term)}</dt><dd>${esc(def)}</dd></div>`).join('\n');
const all = { ...FASHION_BASICS, ...GLOSSARY };
const letters = [...new Set(Object.keys(GLOSSARY).map(t => t[0].toUpperCase()))].sort();

const glossary = page({
  slug: 'glossary',
  title: 'Glossary',
  description: `Plain-English definitions of ${Object.keys(all).length} fashion and theory words, from "look" and "couture" to "camp", "cyborg" and "the uncanny".`,
  body: `    <p class="eyebrow">Glossary</p>
    <h1>The words, explained.</h1>
    <p class="lede">Start with the fashion basics, then the ideas. Each definition gives the plain meaning first, then the thinker it comes from. In any show's notes, tap an underlined word for its definition.</p>

    <h2 id="basics">Fashion basics</h2>
    <dl class="gloss">
${dl(FASHION_BASICS)}
    </dl>

    <h2 id="ideas">Ideas and theory</h2>
    <p class="jump" aria-label="Jump to letter">${letters.map(l => {
      const first = Object.keys(GLOSSARY).sort((a, b) => a.localeCompare(b)).find(t => t[0].toUpperCase() === l);
      return `<a href="#${anchor(first)}">${l}</a>`;
    }).join(' ')}</p>
    <dl class="gloss">
${dl(GLOSSARY)}
    </dl>
    <p>Missing a word? Email <a href="mailto:info@thelexicon.xyz?subject=Glossary%20suggestion">info@thelexicon.xyz</a> and it will be added.</p>`,
});

// ── Privacy ──────────────────────────────────────────────────────────────
const privacy = page({
  slug: 'privacy',
  title: 'Privacy',
  description: 'What THE LEXICON stores about you (very little), for how long, and how to delete it.',
  body: `    <p class="eyebrow">Privacy · updated ${UPDATED}</p>
    <h1>What we store, and why.</h1>
    <p class="lede">You can read everything on THE LEXICON without an account. There is no tracking, no advertising and no analytics.</p>

    <h2>If you just browse</h2>
    <p>Nothing about you is sent to us. A few settings are kept in your own browser so the site remembers them: your theme, your language, shows you have bookmarked or recently opened, reading mode, and whether you have seen the cookie notice. They never leave your device. Clearing your browser's site data removes them.</p>

    <h2>If you sign in</h2>
    <ul>
      <li><strong>Your email address.</strong> Used only to send you a one-time sign-in link. The link expires after 15 minutes and works once.</li>
      <li><strong>Your folders.</strong> The names of the folders you create, the shows you save into them and any notes you add, so they appear on every device you sign in on.</li>
      <li><strong>A sign-in cookie.</strong> One secure cookie that keeps you signed in for up to 30 days. It is essential for signing in and is not used for anything else.</li>
    </ul>
    <p>Sign-in emails are sent through our email provider (Resend). Accounts and folders are stored in our database host (Neon). Both process it only on our behalf.</p>

    <h2>How long we keep it</h2>
    <p>Until you delete your account. You can do that at any time from the sign-in menu (Delete account): your email, your folders and everything in them are deleted at once.</p>

    <h2>Under 18?</h2>
    <p>You can use everything on the site without signing in. If you are under 13, ask a parent or carer before you create an account. We never ask for your age, name or location, there are no public profiles, comments or messages, and nothing you save can be seen by anyone else.</p>

    <h2>Your rights</h2>
    <p>Under UK data protection law you can ask to see, correct or delete the data we hold about you. Email <a href="mailto:info@thelexicon.xyz?subject=Privacy%20request">info@thelexicon.xyz</a>. You can also complain to the Information Commissioner's Office (ico.org.uk).</p>
    <p>THE LEXICON is run by Angelo Sanchez Dela Cruz, London, United Kingdom.</p>`,
});

// ── Terms ────────────────────────────────────────────────────────────────
const terms = page({
  slug: 'terms',
  title: 'Terms',
  description: 'Terms of use for THE LEXICON, including how runway images are used and how rights holders can ask for credit or removal.',
  body: `    <p class="eyebrow">Terms · updated ${UPDATED}</p>
    <h1>Terms of use.</h1>

    <h2>Using the archive</h2>
    <p>THE LEXICON is free to read for research, study, teaching and personal interest. Quote it and cite it (every show has ready-made citations); please don't republish it in bulk or use it commercially without asking. Automated scraping and attempts to overload the site are not allowed, and access may be blocked.</p>

    <h2>No warranty</h2>
    <p>The archive is researched carefully and every show lists its sources, but it is provided as it is, without warranty. If you spot a mistake, email <a href="mailto:info@thelexicon.xyz?subject=Correction">info@thelexicon.xyz</a> and it will be corrected.</p>

    <h2>Images and copyright</h2>
    <p>The runway images are editorial and press photographs from publicly available archives, press releases and published fashion media. They appear in direct support of written commentary (the notes, critique and analysis on each page) and are used under the fair dealing exception for criticism and review in sections 30 and 30A of the Copyright, Designs and Patents Act 1988.</p>
    <p>Copyright in every image stays with its rights holders: photographers, fashion houses and agencies. No commercial use is made of them. They are reproduced at a size suited to analysis, not as a replacement for licensed copies.</p>
    <p>Where the photographer and source are known, they are credited under each image. Rights holders who want to be credited, or who object to their work being included, should email <a href="mailto:info@thelexicon.xyz?subject=Image%20rights">info@thelexicon.xyz</a>. Requests are dealt with within 14 days.</p>

    <h2>Our writing</h2>
    <p>The text, notes, summaries and the way the archive is organised are original work, © Angelo Sanchez Dela Cruz, THE LEXICON, 2026. All rights reserved.</p>`,
});

const pages = { about, glossary, privacy, terms };
for (const [slug, html] of Object.entries(pages)) {
  mkdirSync(join(ROOT, slug), { recursive: true });
  writeFileSync(join(ROOT, slug, 'index.html'), html, 'utf8');
}
console.log(`LEXICON_STATIC_PAGES ok — wrote /${Object.keys(pages).join(', /')}`);
