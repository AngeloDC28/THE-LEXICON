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
export const BROKEN_ASSET = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgMzAwIDQwMCI+PHJlY3Qgd2lkdGg9IjMwMCIga[...]`;

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

  // Already absolute
  if (src.startsWith('http') || src.startsWith('data:')) return src;

  // Remove only leading "./"
  src = src.replace(/^\.\//, '');

  // Determine configured base
  let configuredBase = null;
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="asset-base"]');
    if (meta) configuredBase = meta.getAttribute('content');
  }
  if (typeof window !== 'undefined' && window.LEXICON_ASSET_BASE) configuredBase = window.LEXICON_ASSET_BASE;

  // Compute site-root aware base
  let basePath = '/';
  if (configuredBase) {
    basePath = configuredBase;
  } else if (typeof window !== 'undefined') {
    // Use the current pathname dirname so project pages served under /owner/repo/ resolve correctly
    try {
      const pathname = window.location.pathname || '/';
      // Keep the leading and trailing slash
      basePath = pathname.replace(/\/[^\/]*$/, '/');
    } catch (e) { basePath = '/'; }
  }

  // If src begins with a leading slash, treat as absolute path at origin
  try {
    const base = `${window.location.origin}${basePath}`;
    const url = new URL(src, base);
    return url.toString();
  } catch (e) {
    return `${window.location.origin}/${src}`;
  }
};

export function initCustomCursor() {
  const cursor = $('custom-cursor');
  if (!cursor) return;
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top  = `${e.clientY}px`;
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

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message.toUpperCase();
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}
