/**
 * core-utils.js
 * Basic utility functions for DOM manipulation and data formatting.
 */

export const $ = (id) => document.getElementById(id);
export const $$ = (s) => document.querySelectorAll(s);

export const pad = (num) => (num < 10 ? '0' + num : num);

export const BROKEN_ASSET = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgMzAwIDQwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMxMTEiLz48dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZmlsbD0iIzQ0NCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+RVJST1JfNDA0PC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmaWxsPSIjNDQ0IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJmiWRkbGUiPkFTU0VUX05PVF9GT1VORDwvdGV4dD48cmVjdCB4PSIxMCUiIHk9IjEwJSIgd2lkdGg9IjgwJSIgaGVpZ2h0PSI4MCUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSI0Ii8+PC9zdmc+`;

export const resolveImgSrc = (imgObj, fallback) => {
  let src = (imgObj && imgObj.src) ? imgObj.src : fallback;
  if (!src) return BROKEN_ASSET;
  // Ensure absolute path for Vite public assets
  if (src.startsWith('THE-LEXICON-ASSETS') || src.startsWith('assets')) {
    return '/' + src;
  }
  return src;
};

export function initCustomCursor() {
  const cursor = $('custom-cursor');
  if (!cursor) return;

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });

  document.addEventListener('mousedown', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.9)';
    cursor.style.background = 'var(--accent, #E6FF00)';
  });

  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
    cursor.style.background = 'white';
  });

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
  });
}


export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
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
