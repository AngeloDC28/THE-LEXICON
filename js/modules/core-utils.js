/**
 * core-utils.js
 * Basic utility functions for DOM manipulation and data formatting.
 */

export const $ = (id) => document.getElementById(id);
export const $$ = (s) => document.querySelectorAll(s);

export const pad = (num) => (num < 10 ? '0' + num : num);

export const resolveImgSrc = (imgObj, fallback) => {
  if (imgObj && imgObj.src) return imgObj.src;
  return fallback || '';
};

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
