/**
 * DYNAMIC INTELLIGENCE BRIEFINGS — OG META TAG INJECTION
 * ──────────────────────────────────────────────────────────
 * Vercel Serverless Function (Node.js runtime)
 *
 * PROBLEM:
 * Hash fragments (#mcqueen-ss99) are never sent to the server.
 * Social media scrapers (Twitter, Facebook, Discord, etc.) do not
 * execute client-side JavaScript. They see only the default OG tags.
 *
 * SOLUTION:
 * 1. vercel.json rewrites /?id=mcqueen-ss99 → /api/og
 * 2. This function reads the `id` query param
 * 3. Cross-references it against the live archiveData from database.js
 * 4. Reads the root index.html from disk (zero network round-trip)
 * 5. Performs regex string replacement on og:title, og:description,
 *    og:image, <title>, and injects twitter:card tags
 * 6. Returns the modified HTML to the scraper
 *
 * DATA ARCHITECTURE:
 * database.js uses a conditional export pattern:
 *   if (typeof module !== 'undefined' && module.exports) {
 *     module.exports = archiveData;
 *   }
 * This allows require('../database.js') to work in Node.js while
 * keeping archiveData as a global in the browser. No bundler needed.
 */

const fs = require('fs');
const path = require('path');

// ── Import the live archive data (single source of truth) ──
const archiveData = require('../database.js');

// ── Configuration ──
const BASE_URL = 'https://thelexicon.xyz';

// ── Bot detection: social media and search engine scrapers ──
const BOT_PATTERNS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'googlebot', 'bingbot',
  'applebot', 'embedly', 'quora link preview', 'showyoubot',
  'outbrain', 'pinterest', 'vkshare', 'w3c_validator', 'iframely',
  'mj12bot', 'semrushbot', 'ahrefsbot', 'petalbot', 'yandexbot',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(function (bot) { return ua.includes(bot); });
}

// ── HTML entity escaping for safe meta tag injection ──
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Read index.html once and cache in memory (cold start optimization) ──
let cachedHtml = null;

function getBaseHtml() {
  if (cachedHtml) return cachedHtml;
  const htmlPath = path.join(__dirname, '..', 'index.html');
  cachedHtml = fs.readFileSync(htmlPath, 'utf-8');
  return cachedHtml;
}

// ── Main handler ──
module.exports = function handler(req, res) {
  const entryId = req.query.id;

  // No ID provided — serve original HTML unmodified
  if (!entryId) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(getBaseHtml());
  }

  // Look up the entry in the live archiveData array
  const entry = archiveData.find(function (e) { return e.id === entryId; });

  // Unknown entry ID — serve original HTML
  if (!entry) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(getBaseHtml());
  }

  // ── Build OG meta values from the entry data ──
  const brand = entry.tags.brand;
  const year = entry.year;
  const form = entry.tags.form || '';
  const politics = entry.tags.politics || '';
  const imageUrl = entry.images && entry.images[0]
    ? entry.images[0]
    : entry.imageUrl || '';

  const ogTitle = brand + ' ' + year + ' \u2014 THE LEXICON';
  const ogDescription = brand + ' ' + year + ' ; A forensic audit of '
    + form + ' and ' + politics
    + '. Access the cultural directory to map the structural precedent.';
  const ogImage = BASE_URL + '/' + imageUrl;
  const ogUrl = BASE_URL + '/#' + entryId;

  // ── Read the base HTML and perform string replacements ──
  let html = getBaseHtml();

  // Replace existing og:title
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    '<meta property="og:title" content="' + escapeHtml(ogTitle) + '" />'
  );

  // Replace existing og:description
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    '<meta property="og:description" content="' + escapeHtml(ogDescription) + '" />'
  );

  // Replace existing og:image
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    '<meta property="og:image" content="' + escapeHtml(ogImage) + '" />'
  );

  // Replace <title> tag
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    '<title>' + escapeHtml(ogTitle) + '</title>'
  );

  // Inject og:url and Twitter Card tags before </head>
  const injectedMeta = '\n'
    + '  <meta property="og:url" content="' + escapeHtml(ogUrl) + '" />\n'
    + '  <meta property="og:type" content="article" />\n'
    + '  <meta name="twitter:card" content="summary_large_image" />\n'
    + '  <meta name="twitter:title" content="' + escapeHtml(ogTitle) + '" />\n'
    + '  <meta name="twitter:description" content="' + escapeHtml(ogDescription) + '" />\n'
    + '  <meta name="twitter:image" content="' + escapeHtml(ogImage) + '" />\n';

  html = html.replace('</head>', injectedMeta + '</head>');

  // ── Serve the modified HTML ──
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(html);
};
