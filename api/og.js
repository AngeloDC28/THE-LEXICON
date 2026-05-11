/**
 * FEATURE 3: DYNAMIC INTELLIGENCE BRIEFINGS (OG META TAGS)
 * 
 * Vercel Edge Function that intercepts incoming requests for deep links
 * (e.g., thelexicon.xyz/#mcqueen-ss99) and injects correct OG meta tags
 * into the raw HTML before serving. This ensures social media scrapers
 * (which do NOT execute client-side JS) display the correct entry image
 * and title in preview cards.
 * 
 * ROUTING: Configured via vercel.json to intercept all root requests.
 * The function reads the 'id' query param (rewritten from the hash
 * fragment by Vercel's routing config) and cross-references it with
 * the archive data embedded below.
 * 
 * HOW IT WORKS:
 * 1. Vercel rewrites /?id=mcqueen-ss99 → this function
 * 2. Function fetches the original index.html from origin
 * 3. Injects correct og:title, og:description, og:image into <head>
 * 4. Returns modified HTML to the scraper
 * 
 * For non-bot user agents, or when no valid ID is found, the function
 * passes through to the static index.html unmodified.
 */

// ── ARCHIVE DATA (mirror of database.js entries for OG lookup) ──
// This must be kept in sync with database.js. Only ID, brand, year,
// season, image, and tag data needed for meta generation.
const ARCHIVE_ENTRIES = {
  'mcqueen-ss99': {
    brand: 'Alexander McQueen', year: 1999, season: 'SS',
    subtitle: 'No. 13',
    image: 'THE-LEXICON-ASSETS/mcqueen-ss99/mcqueen-ss99-01.jpg',
    form: 'Prosthetic Extension',
    politics: 'Body Politics & Corporeal Interventions',
  },
  'mugler-aw95': {
    brand: 'Thierry Mugler', year: 1995, season: 'AW',
    subtitle: 'Anniversaire',
    image: 'THE-LEXICON-ASSETS/mugler-aw95/mugler-aw95-01.jpg',
    form: 'Architectural Shielding and Armour',
    politics: 'Feminist Theory & The Subverted Gaze',
  },
  'miyake-ss99': {
    brand: 'Issey Miyake', year: 1999, season: 'SS',
    subtitle: 'A-POC',
    image: 'THE-LEXICON-ASSETS/miyake-ss99/miyake-ss99-01.jpg',
    form: 'Modular Componentry',
    politics: 'Ecological Politics & Resource Extraction',
  },
  'balenciaga-ss07': {
    brand: 'Balenciaga', year: 2007, season: 'SS',
    subtitle: 'Robotic Articulation',
    image: 'THE-LEXICON-ASSETS/balenciaga-ss07/balenciaga-ss07-01.jpg',
    form: 'Architectural Shielding and Armour',
    politics: 'Techno-Politics & Digital Identities',
  },
  'chalayan-aw00': {
    brand: 'Hussein Chalayan', year: 2000, season: 'AW',
    subtitle: 'After Words',
    image: 'THE-LEXICON-ASSETS/chalayan-aw00/chalayan-aw00-01.jpg',
    form: 'Adaptive Transformation',
    politics: 'Post-Colonialism & Diasporic Narratives',
  },
  'prada-ss96': {
    brand: 'Prada', year: 1996, season: 'SS',
    subtitle: 'Banal Eccentricity',
    image: 'THE-LEXICON-ASSETS/prada-ss96/prada-ss99-01.jpg',
    form: 'Compressed Proportions',
    politics: 'Anti-Consumerism & Institutional Critique',
  },
  'galliano-dior-ss00': {
    brand: 'Christian Dior', year: 2000, season: 'SS',
    subtitle: 'Clochard',
    image: 'THE-LEXICON-ASSETS/galliano-dior-ss00/galliano-dior-ss00-01.jpg',
    form: 'Bias-Cut Fluidity',
    politics: 'Class Dynamics & Anti-Elitism',
  },
  'owens-ss14': {
    brand: 'Rick Owens', year: 2014, season: 'SS',
    subtitle: 'Vicious',
    image: 'THE-LEXICON-ASSETS/owens-ss14/owens-ss14-01.jpg',
    form: 'Suspended Drape',
    politics: 'Racial Identity & Representation',
  },
  'garcons-ss97': {
    brand: 'Comme des Garçons', year: 1997, season: 'SS',
    subtitle: 'Body Meets Dress; Dress Meets Body',
    image: 'THE-LEXICON-ASSETS/garcons-ss97/garcons-ss97-01.jpg',
    form: 'Displaced Anatomy and Padding',
    politics: 'Body Politics & Corporeal Interventions',
  },
  'yamamoto-aw98': {
    brand: 'Yohji Yamamoto', year: 1998, season: 'AW',
    subtitle: '',
    image: 'THE-LEXICON-ASSETS/yamamoto-aw98/yamamoto-aw98-01.jpg',
    form: 'Monolithic Massing',
    politics: 'Globalisation & Cultural Hybridity',
  },
  'gaultier-ss94': {
    brand: 'Jean Paul Gaultier', year: 1994, season: 'SS',
    subtitle: 'Les Tatouages',
    image: 'THE-LEXICON-ASSETS/gaultier-ss94/gaultier-ss94-01.jpg',
    form: 'Topographic Layering',
    politics: 'Queer Theory & Subcultural Systems',
  },
  'viktor-rolf-aw99': {
    brand: 'Viktor & Rolf', year: 1999, season: 'AW',
    subtitle: 'Russian Doll',
    image: 'THE-LEXICON-ASSETS/viktor-rolf-aw99/viktor-rolf-aw99-01.jpg',
    form: 'Monolithic Massing',
    politics: 'Anti-Consumerism & Institutional Critique',
  },
  'lang-aw98': {
    brand: 'Helmut Lang', year: 1998, season: 'AW',
    subtitle: 'Séance de Travail',
    image: 'THE-LEXICON-ASSETS/lang-aw98/lang-aw98-01.jpg',
    form: 'Tailored Rigidity',
    politics: 'Anti-Consumerism & Institutional Critique',
  },
  'moschino-aw14': {
    brand: 'Moschino', year: 2014, season: 'AW',
    subtitle: '',
    image: 'THE-LEXICON-ASSETS/moschino-aw14/moschino-aw14-01.jpg',
    form: 'Compressed Proportions',
    politics: 'Anti-Consumerism & Institutional Critique',
  },
  'schiaparelli-ss21': {
    brand: 'Schiaparelli', year: 2021, season: 'SS',
    subtitle: '',
    image: 'THE-LEXICON-ASSETS/schiaparelli-ss21/schiaparelli-ss21-01.jpg',
    form: 'Prosthetic Extension',
    politics: 'Feminist Theory & The Subverted Gaze',
  },
};

const BASE_URL = 'https://thelexicon.xyz';

// Bot detection: common social media / scraper user agents
const BOT_PATTERNS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'telegrambot', 'whatsapp', 'discordbot', 'googlebot', 'bingbot',
  'applebot', 'embedly', 'quora link preview', 'showyoubot',
  'outbrain', 'pinterest', 'vkshare', 'w3c_validator', 'iframely',
  'mj12bot', 'semrushbot', 'ahrefsbot',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(function (bot) { return ua.includes(bot); });
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const entryId = url.searchParams.get('id');
  const userAgent = request.headers.get('user-agent') || '';

  // Only intercept if we have an entry ID AND the request is from a bot
  if (!entryId || !isBot(userAgent)) {
    // Pass through to static hosting
    const originUrl = `${BASE_URL}/index.html`;
    const originResponse = await fetch(originUrl);
    return new Response(originResponse.body, {
      status: originResponse.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  const entry = ARCHIVE_ENTRIES[entryId];

  if (!entry) {
    // Unknown entry — serve original page
    const originUrl = `${BASE_URL}/index.html`;
    const originResponse = await fetch(originUrl);
    return new Response(originResponse.body, {
      status: originResponse.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }

  // Build OG meta values
  const ogTitle = `${entry.brand} ${entry.year} — THE LEXICON`;
  const ogDescription = `${entry.brand} ${entry.year} ; A forensic audit of ${entry.form} and ${entry.politics}. Access the cultural directory to map the structural precedent.`;
  const ogImage = `${BASE_URL}/${entry.image}`;
  const ogUrl = `${BASE_URL}/#${entryId}`;

  // Fetch the original HTML
  const originUrl = `${BASE_URL}/index.html`;
  const originResponse = await fetch(originUrl);
  let html = await originResponse.text();

  // Inject / replace OG meta tags in the <head>
  // Replace existing og:title
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`
  );

  // Replace existing og:description
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`
  );

  // Replace existing og:image
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`
  );

  // Inject og:url and twitter card tags if not present
  const twitterMeta = `
    <meta property="og:url" content="${escapeHtml(ogUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  `;

  // Insert before </head>
  html = html.replace('</head>', twitterMeta + '</head>');

  // Update <title> tag
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(ogTitle)}</title>`
  );

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
