/**
 * storage.js
 * Logic for bookmarks, recently viewed, and local storage.
 */

import { $, resolveImgSrc, thumbSrc, BROKEN_ASSET } from './core-utils.js?v=4858eed';
import { AppState } from './core-state.js?v=4858eed';
import { getTranslation } from './translations.js?v=4858eed';
import { safeCover } from './categories.js?v=4858eed';

export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('lexicon-bookmarks') || '[]'); } catch(e) { return []; }
}

function setBookmarks(arr) {
  try { localStorage.setItem('lexicon-bookmarks', JSON.stringify(arr)); } catch(e) {}
}

export function isBookmarked(id) {
  return getBookmarks().includes(id);
}

export function toggleBookmark(id, callbacks) {
  let bm = getBookmarks();
  const lang = AppState.language;
  if (bm.includes(id)) {
    bm = bm.filter(x => x !== id);
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('bookmark_removed', lang));
  } else {
    bm.unshift(id);
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('bookmarked', lang));
  }
  setBookmarks(bm);
  if (callbacks && callbacks.updateBookmarkUI) callbacks.updateBookmarkUI(id);
}

// ── Saved searches ────────────────────────────────────────────────────────────
// Stored LOCALLY ONLY (localStorage) by design: the backend persists nothing
// beyond email + folders (data-minimisation / GDPR posture). Saved searches
// therefore never leave the device and add zero server-side PII.
const SAVED_SEARCH_KEY = 'lexicon-saved-searches';

export function getSavedSearches() {
  try { return JSON.parse(localStorage.getItem(SAVED_SEARCH_KEY) || '[]'); } catch(e) { return []; }
}

function setSavedSearches(arr) {
  try { localStorage.setItem(SAVED_SEARCH_KEY, JSON.stringify(arr)); } catch(e) {}
}

/** Persist a named search state. Returns the new id, or null if an identical
 *  state is already saved (so the same search can't be saved twice). */
export function saveSearch(name, state) {
  const arr = getSavedSearches();
  const sig = JSON.stringify(state);
  if (arr.some(s => JSON.stringify(s.state) === sig)) return null;
  const id = 'ss-' + Date.now().toString(36);
  arr.unshift({ id, name, state, createdAt: Date.now() });
  if (arr.length > 20) arr.length = 20;
  setSavedSearches(arr);
  return id;
}

export function deleteSavedSearch(id) {
  setSavedSearches(getSavedSearches().filter(s => s.id !== id));
}

function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('lexicon-recent') || '[]'); } catch(e) { return []; }
}

export function addRecentlyViewed(entryId, archiveData, callbacks) {
  let recent = getRecentlyViewed().filter(id => id !== entryId);
  recent.unshift(entryId);
  if (recent.length > 8) recent = recent.slice(0, 8);
  try { localStorage.setItem('lexicon-recent', JSON.stringify(recent)); } catch(e) {}
  renderRecentlyViewed(archiveData, callbacks);
}

function renderRecentlyViewed(archiveData, callbacks) {
  const recent = getRecentlyViewed();
  const container = $('recent-container');
  const row = $('recent-row');
  if (!recent.length || !container || !row) {
    if (container) container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  let html = '';
  recent.forEach(id => {
    const entry = archiveData.find(e => e.id === id);
    if (!entry) return;
    const small = safeCover(entry) ? resolveImgSrc({ src: thumbSrc(safeCover(entry)) }) : resolveImgSrc(null);
    const label = `${entry.tags?.brand || ''} ${entry.year || ''}`.trim();
    html += `
      <button type="button" class="recent-thumb-btn focus-ring" data-recent-id="${id}" aria-label="Open ${label}">
        <img src="${small}"
             alt=""
             class="recent-thumb opacity-0"
             loading="lazy" />
      </button>
    `;
  });
  row.innerHTML = html;
  row.querySelectorAll('img.recent-thumb').forEach(img => {
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      img.classList.remove('opacity-0');
    });
    img.addEventListener('error', () => {
      // Thumbnail missing (e.g. a brand-new image not yet optimised):
      // fall back to the full file once, then to the placeholder.
      const full = resolveImgSrc(archiveData.find(e => e.id === img.closest('[data-recent-id]')?.dataset.recentId) ? safeCover(archiveData.find(e => e.id === img.closest('[data-recent-id]')?.dataset.recentId)) : null);
      img.addEventListener('error', () => { img.src = BROKEN_ASSET; img.classList.remove('opacity-0'); }, { once: true });
      img.src = full;
    }, { once: true });
  });
}
