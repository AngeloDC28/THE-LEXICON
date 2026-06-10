/**
 * core-utils.js
 * Basic utility functions for DOM manipulation and data formatting.
 * FIX: BROKEN_ASSET SVG was correct; resolveImgSrc improved to handle
 * relative paths robustly regardless of host subdirectory.
 */
export const $ = (id) => document.getElementById(id);
export const $$ = (s) => document.querySelectorAll(s);
export const pad = (num) => (num < 10 ? '0' + num : num);

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

