/**
 * core-utils.js
 * Basic utility functions for DOM manipulation and data formatting.
 * FIX: BROKEN_ASSET SVG was correct; resolveImgSrc improved to handle
 * relative paths robustly regardless of host subdirectory.
 */
export const $ = (id) => document.getElementById(id);
export const $$ = (s) => document.querySelectorAll(s);
export const pad = (num) => (num < 10 ? '0' + num : num);

// Tracks whether a transition is currently in flight. Two callers can
// legitimately fire back-to-back in the same tick (e.g. a cold-boot deep
// link does switchView('grid') immediately followed by openDetail(), both
// wrapped in withViewTransition) — calling startViewTransition() again
// before the first one settles throws InvalidStateError in Chrome, even
// after skipTransition(), because the skip itself isn't synchronous. So
// rather than racing a skip against a restart, a transition already in
// flight just makes this call a plain, unanimated DOM update.
let _transitionInFlight = false;
let _currentTransition = null;

export function withViewTransition(updateDOM) {
  // A transition already in flight hasn't necessarily run ITS update yet
  // (the browser captures the old frame first). Running this update now
  // would let that earlier update land afterwards and undo it: tapping
  // Index straight after Timeline left the Timeline on screen. So queue
  // this update behind the earlier one; it still runs unanimated.
  if (_transitionInFlight && _currentTransition) {
    _currentTransition.updateCallbackDone.catch(() => {}).finally(() => updateDOM());
    return;
  }
  if (!document.startViewTransition || _transitionInFlight || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    updateDOM();
    return;
  }
  try {
    const transition = document.startViewTransition(() => updateDOM());
    _currentTransition = transition;
    _transitionInFlight = true;
    // `ready` rejects whenever the animation is skipped — most commonly
    // because the tab is in the background ("Document hidden"). The DOM
    // update still runs, so that rejection is expected, not an error;
    // left unhandled it surfaces as an uncaught promise rejection on every
    // page opened in a background tab.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => { _transitionInFlight = false; _currentTransition = null; });
  } catch (e) {
    updateDOM();
  }
}

/**
 * The element that scrolls the archive. On phones (below 768px) the whole
 * page scrolls (index.css "M1"); on wider screens the image panel does.
 * Save and restore scroll positions through this, never a fixed element.
 */
export function pageScroller() {
  return window.matchMedia('(max-width: 767px)').matches
    ? (document.scrollingElement || document.documentElement)
    : (document.getElementById('image-panel') || document.scrollingElement);
}

// Valid fallback SVG — dark panel with centered ERROR_404 text
export const BROKEN_ASSET = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgMzAwIDQwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMxMTEiLz48dGV4dCB4PSIxNTAiIHk9IjIwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzU1NSI+RVJST1JfNDA0PC90ZXh0Pjwvc3ZnPg==`;

/**
 * resolveImgSrc
 * Normalises image paths to absolute URLs relative to the detected site root.
 * - Accepts absolute (http/data) ULRs unchanged.
 * - Strips leading ./ and anchors relative paths to a computed asset base.
 * - Reads a configurable base from <meta name="asset-base" content="..."> or window.LEXICON_ASSET_BASE.
 * This handles hosting under repo subpaths (e.g., GitHub Pages project sites).
 */
export const resolveImgSrc = (imgObj, fallback) => {
  let src = (imgObj && imgObj.src) ? imgObj.src : fallback;
  if (!src || typeof src !== 'string') return BROKEN_ASSET;

  // Already absolute or data URI
  if (src.startsWith('http') || src.startsWith('data:')) return src;

  // Normalize: remove leading ./ and ensure it starts with /
  src = src.replace(/^\.\//, '');
  if (!src.startsWith('/')) src = '/' + src;

  // Get base path from meta or global
  let base = '';
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="asset-base"]');
    if (meta) base = meta.getAttribute('content') || '';
  }
  if (typeof window !== 'undefined' && window.LEXICON_ASSET_BASE) {
    base = window.LEXICON_ASSET_BASE;
  }

  // Handle trailing slash vs leading slash overlap
  if (base.endsWith('/') && src.startsWith('/')) {
    return base + src.substring(1);
  }
  if (!base.endsWith('/') && !src.startsWith('/')) {
    return base + '/' + src;
  }
  
  return base + src;
};

export function initCustomCursor() {
  const cursor = $('custom-cursor');
  if (!cursor) return;
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top  = `${e.clientY}px`;
    cursor.style.visibility = 'visible'; // starts hidden so it doesn't sit parked at (0,0)
  });
  document.addEventListener('mousedown', () => {
    cursor.classList.add('cursor-expanding');
  });
  document.addEventListener('mouseup', () => {
    cursor.classList.remove('cursor-expanding');
  });
  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter',  () => { cursor.style.opacity = '1'; });
}

/**
 * imgAttrs — return ` width="X" height="Y"` for a given image src (or empty
 * string if we don't have dimensions). Use it inline in template literals
 * so every <img> ships with explicit dimensions and the browser reserves
 * space, eliminating Cumulative Layout Shift.
 */
let _imgDimsMap = null;
export function setImageDimensions(map) { _imgDimsMap = map; }
export function imgAttrs(srcOrObj) {
  if (!_imgDimsMap) return '';
  const src = typeof srcOrObj === 'string' ? srcOrObj : (srcOrObj && srcOrObj.src) || '';
  const d = _imgDimsMap[src];
  return d ? ` width="${d.w}" height="${d.h}"` : '';
}

/**
 * webpSrc — derive the WebP sibling URL for any JPEG/PNG src.
 * The optimize-images.mjs pass writes a .webp next to every .jpg/.png,
 * so this is just a string substitution.
 */
export function webpSrc(srcOrObj) {
  const src = typeof srcOrObj === 'string' ? srcOrObj : (srcOrObj && srcOrObj.src) || '';
  if (!src) return '';
  return src.replace(/\.(jpe?g|png)$/i, '.webp');
}

/**
 * thumbSrc — the 480px-wide WebP thumbnail written by resize-images.mjs
 * next to every archive image (foo-01.jpg → foo-01.t480.webp). Anything
 * that renders an image smaller than the detail view should use this: the
 * grid alone shows 550+ images, and serving the full file into a ~200px
 * tile is both slow and more resolution than critical analysis needs.
 */
export function thumbSrc(srcOrObj) {
  const src = typeof srcOrObj === 'string' ? srcOrObj : (srcOrObj && srcOrObj.src) || '';
  if (!src) return '';
  return src.replace(/\.(jpe?g|png|webp)$/i, '.t480.webp');
}

/** Escape text for safe interpolation into innerHTML or a quoted attribute. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * excerpt — shorten prose to at most `max` characters without cutting a
 * word in half. Strips tags and [cite: n] markers first; when it has to
 * truncate it backs up to the last word boundary and ends with an ellipsis
 * rather than a full stop, so a cut never reads as a finished sentence.
 */
export function excerpt(text, max = 120) {
  const clean = String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[cite:\s*\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const body = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : clean.slice(0, max));
  return body.replace(/[\s,;:.\-–—(]+$/, '') + '…';
}

// Abbreviations that end in a full stop but don't end a sentence. Splitting
// on them turned McQueen's critique into the pull-quote "13 constitutes a
// foundational document..." with the paragraph starting "No. By placing...".
const NON_TERMINAL = /\b(No|Nos|St|Dr|Mr|Mrs|Ms|Mt|vs|etc|e\.g|i\.e|c|ca|cf|approx|Vol|Fig|Jr|Sr)\.$/i;

/** Split prose into sentences without breaking on "No.", "St.", "vs." etc. */
export function splitSentences(text) {
  const parts = String(text ?? '').split(/(?<=[.!?])\s+/);
  const out = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    // Also glue a split before a lower-case word or a digit: "No. 13", "c. 1999".
    if (prev && (NON_TERMINAL.test(prev) || /^[a-z0-9]/.test(part))) out[out.length - 1] = `${prev} ${part}`;
    else out.push(part);
  }
  return out;
}

// Short names for tight labels (Nexus graph nodes). Cutting at a fixed
// length gave "UNDERCOVE", "BALENCIAG", "ALEXANDER MCQU".
const SHORT_BRAND = {
  'Comme des Garçons': 'CDG', 'Hood By Air (HBA)': 'HBA', 'Viktor & Rolf': 'V&R',
  'Iris van Herpen': 'Van Herpen', 'Dries Van Noten': 'Van Noten', 'Bottega Veneta': 'Bottega',
  'Christian Dior': 'Dior', 'Maison Margiela': 'Margiela', 'Louis Vuitton': 'Vuitton',
  'Saint Laurent': 'Saint Laurent', 'Calvin Klein': 'Calvin Klein', 'Miu Miu': 'Miu Miu',
  'JW Anderson': 'JW Anderson',
};
/** "Alexander McQueen" → "McQueen", "Comme des Garçons" → "CDG", "Gucci" → "Gucci". */
export function shortBrand(brand) {
  const b = String(brand || '').trim();
  if (SHORT_BRAND[b]) return SHORT_BRAND[b];
  const words = b.split(/\s+/);
  return words.length > 1 ? words[words.length - 1] : b;
}

/** "SS" → "Spring/Summer", "AW" → "Autumn/Winter"; anything else unchanged. */
export function seasonLong(season) {
  const s = String(season || '').toUpperCase();
  return s === 'SS' ? 'Spring/Summer' : s === 'AW' || s === 'FW' ? 'Autumn/Winter' : (season || '');
}

/**
 * The one line a newcomer reads about a show: the plain summary when the entry
 * has one, otherwise the first sentence of the critique.
 */
export function entrySummary(entry, translate = (s) => s, max = 200) {
  if (entry?.summary_plain) return translate(entry.summary_plain);
  const raw = entry?.notes?.critique || entry?.notes?.provenance || '';
  return excerpt(splitSentences(translate(raw))[0] || '', max);
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

let _toastTimer = null;
export function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message.toUpperCase();
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    toast.classList.add('hidden');
    _toastTimer = null;
  }, 3000);
}

