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
export const BROKEN_ASSET = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgMzAwIDQwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMxMTEiLz48dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZmlsbD0iIzQ0NCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+RVJST1JfNDA0PC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmaWxsPSIjNDQ0IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkFTU0VUX05PVF9GT1VORDwvdGV4dD48cmVjdCB4PSIxMCUiIHk9IjEwJSIgd2lkdGg9IjgwJSIgaGVpZ2h0PSI4MCUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSI0Ii8+PC9zdmc+`;

/**
 * resolveImgSrc
 * FIX: Normalises all image paths to absolute URLs relative to the site root.
 * Previously, paths like "THE-LEXICON-ASSETS/foo.jpg" resolved differently
 * depending on which JS module called them. Now they are all anchored to
 * window.location.origin so they work from any module depth.
 */
export const resolveImgSrc = (imgObj, fallback) => {
  let src = (imgObj && imgObj.src) ? imgObj.src : fallback;
  if (!src || typeof src !== 'string') return BROKEN_ASSET;

  // Already absolute
  if (src.startsWith('http') || src.startsWith('data:')) return src;

  // Strip leading slash or ./ — then anchor to origin
  src = src.replace(/^\.?\//, '');

  // Return as an absolute path from the site root
  return `${window.location.origin}/${src}`;
};

export function initCustomCursor() {
  const cursor = $('custom-cursor');
  if (!cursor) return;
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top  = `${e.clientY}px`;
  });
  document.addEventListener('mousedown', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.9)';
    cursor.style.background = 'var(--accent, #E6FF00)';
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
    cursor.style.background = 'white';
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
