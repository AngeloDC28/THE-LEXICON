/**
 * storage.js
 * Logic for bookmarks, recently viewed, and local storage.
 */

import { $, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';

export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('lexicon-bookmarks') || '[]'); } catch(e) { return []; }
}

export function setBookmarks(arr) {
  localStorage.setItem('lexicon-bookmarks', JSON.stringify(arr));
}

export function isBookmarked(id) {
  return getBookmarks().includes(id);
}

export function toggleBookmark(id, callbacks) {
  let bm = getBookmarks();
  if (bm.includes(id)) {
    bm = bm.filter(x => x !== id);
    if (callbacks && callbacks.showToast) callbacks.showToast('Bookmark removed');
  } else {
    bm.unshift(id);
    if (callbacks && callbacks.showToast) callbacks.showToast('Bookmarked');
  }
  setBookmarks(bm);
  if (callbacks && callbacks.updateBookmarkUI) callbacks.updateBookmarkUI(id);
}

export function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('lexicon-recent') || '[]'); } catch(e) { return []; }
}

export function addRecentlyViewed(entryId, archiveData, callbacks) {
  let recent = getRecentlyViewed().filter(id => id !== entryId);
  recent.unshift(entryId);
  if (recent.length > 8) recent = recent.slice(0, 8);
  localStorage.setItem('lexicon-recent', JSON.stringify(recent));
  renderRecentlyViewed(archiveData, callbacks);
}

export function renderRecentlyViewed(archiveData, callbacks) {
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
    const thumbSrc = resolveImgSrc(entry.images && entry.images[0], entry.imageUrl);
    html += `
      <img src="${thumbSrc}" 
           alt="${entry.tags.brand}" 
           class="recent-thumb opacity-0" 
           data-recent-id="${id}" 
           loading="lazy" 
           onload="this.classList.add('loaded'); this.style.opacity='1';"
           onerror="this.src='${BROKEN_ASSET}'; this.classList.add('loaded');" />
    `;
  });
  row.innerHTML = html;
}
