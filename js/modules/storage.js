/**
 * storage.js
 * Logic for bookmarks, recently viewed, and local storage.
 */

import { $, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

function getBookmarks() {
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
    const thumbSrc = resolveImgSrc(entry.images && entry.images[0]);
    const label = `${entry.tags.brand || ''} ${entry.year || ''}`.trim();
    html += `
      <button type="button" class="recent-thumb-btn focus-ring" data-recent-id="${id}" aria-label="Open ${label}">
        <img src="${thumbSrc}"
             alt=""
             class="recent-thumb opacity-0"
             loading="lazy"
             onload="this.classList.add('loaded'); this.style.opacity='1';"
             onerror="this.onerror=null;this.src='${BROKEN_ASSET}';this.classList.add('loaded');" />
      </button>
    `;
  });
  row.innerHTML = html;
}
