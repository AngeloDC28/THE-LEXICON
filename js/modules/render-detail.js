/**
 * render-detail.js
 * Logic for detail view, hotspots, and metadata.
 */

import { $, pad, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState, stickyNotes, updateHash } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';

export function updateStatusBar(archiveData) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  const brand = $('status-brand');
  const year = $('status-year');
  const season = $('status-season');
  const entryStatus = $('status-entry');

  if (entry) {
    if (brand) brand.textContent = entry.tags.brand;
    if (year) year.textContent = entry.year;
    if (season) season.textContent = entry.season;
    if (entryStatus) entryStatus.textContent = pad(archiveData.indexOf(entry) + 1) + ' / ' + pad(archiveData.length);
  } else {
    const filtered = getFilteredEntries(archiveData);
    if (brand) brand.textContent = '--';
    if (year) year.textContent = '--';
    if (season) season.textContent = '--';
    if (entryStatus) entryStatus.textContent = pad(filtered.length) + ' ENTRIES';
  }
}

export function openDetail(entryId, imgIdx, archiveData, callbacks) {
  console.log('LEXICON_ACTION: OPEN_DETAIL_INIT', { entryId, imgIdx });
  const entry = archiveData.find((e) => e.id === entryId);
  if (!entry) return;

  AppState.selectedEntryId = entryId;
  const imgs = entry.images || [{src: entry.imageUrl}];
  AppState.currentImageIndex = (typeof imgIdx === 'number') ? Math.min(imgIdx, imgs.length - 1) : 0;

  // UI state
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const detailView = $('detail-image-view');
  if (detailView) detailView.classList.remove('hidden');
  
  const appRoot = $('app-root');
  if (appRoot) appRoot.classList.add('detail-mode-active');

  // Render content
  renderImage(entry);
  renderMetadata(entry);
  renderHotspots(entry, detailView);
  renderRelatedEntries(entry, archiveData, callbacks);
  
  // Callbacks
  if (callbacks) {
    if (callbacks.updateHeaderTelemetry) callbacks.updateHeaderTelemetry(`ACCESSING_NODE: ${entry.id.toUpperCase()}`);
    if (callbacks.addRecentlyViewed) callbacks.addRecentlyViewed(entryId);
    if (callbacks.updateBookmarkUI) callbacks.updateBookmarkUI(entryId);
    if (callbacks.updateMetaForEntry) callbacks.updateMetaForEntry(entry);
    if (callbacks.extractAccentColor) {
      const img = $('detail-image');
      if (img) {
        if (img.complete) callbacks.extractAccentColor(img);
        else img.addEventListener('load', () => callbacks.extractAccentColor(img), { once: true });
      }
    }
  }

  updateHash(`detail/${entryId}`);
  updateStatusBar(archiveData);
}

export function closeDetail(callbacks, archiveData) {
  AppState.selectedEntryId = null;
  updateHash(null);

  const detailView = $('detail-image-view');
  if (detailView) detailView.classList.add('hidden');
  
  const appRoot = $('app-root');
  if (appRoot) appRoot.classList.remove('detail-mode-active');

  if (callbacks && callbacks.resetMeta) callbacks.resetMeta();
  const glow = $('accent-glow');
  if (glow) glow.style.boxShadow = '';

  updateStatusBar(archiveData);
}

export function navigateEntry(direction, archiveData, callbacks) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;

  const imgs = entry.images || [{src: entry.imageUrl}];
  const nextImg = AppState.currentImageIndex + direction;

  // Navigate images within same entry
  if (nextImg >= 0 && nextImg < imgs.length) {
    openDetail(entry.id, nextImg, archiveData, callbacks);
    return;
  }

  // Navigate between entries
  const entries = getFilteredEntries(archiveData);
  if (entries.length <= 1) return;

  let currentIndex = entries.findIndex(e => e.id === AppState.selectedEntryId);
  if (currentIndex === -1) return;

  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = entries.length - 1;
  if (newIndex >= entries.length) newIndex = 0;

  const nextEntry = entries[newIndex];
  const startImg = direction > 0 ? 0 : (nextEntry.images || [1]).length - 1;
  openDetail(nextEntry.id, startImg, archiveData, callbacks);
}

function renderImage(entry) {
  const imgs = entry.images || [{src: entry.imageUrl}];
  const currentImgObj = imgs[AppState.currentImageIndex];
  const currentImgSrc = resolveImgSrc(currentImgObj, entry.imageUrl);

  const imgEl = $('detail-image');
  if (imgEl) {
    imgEl.src = currentImgSrc;
    imgEl.alt = entry.title || entry.id;
    imgEl.onerror = () => {
      imgEl.src = BROKEN_ASSET;
      imgEl.classList.add('broken-asset');
    };
    
    // Improved animation handling: clear existing and re-trigger
    imgEl.classList.remove('scanning');
    void imgEl.offsetWidth; // Trigger reflow
    imgEl.classList.add('scanning');
    
    // Remove scan after 2 seconds for clarity
    if (window._scanTimeout) clearTimeout(window._scanTimeout);
    window._scanTimeout = setTimeout(() => imgEl.classList.remove('scanning'), 2000);
  }

  const titleEl = $('active-entry-title');
  if (titleEl) {
    titleEl.textContent = `${entry.tags.brand} ${entry.year} [${pad(AppState.currentImageIndex + 1)}/${pad(imgs.length)}]`;
  }
}

function renderMetadata(entry) {
  const grid = $('metadata-grid');
  if (!grid) return;

  const fields = [
    { label: 'ERA', value: entry.tags.era },
    { label: 'GENDER', value: entry.tags.gender },
    { label: 'POLITICS', value: entry.tags.politics },
    { label: 'THEORIES', value: entry.tags.theories },
    { label: 'MATERIALS', value: entry.tags.materials },
    { label: 'GEOGRAPHY', value: entry.tags.geography }
  ];

  grid.innerHTML = fields.map(f => `
    <div>
      <p class="text-[8px] opacity-40 uppercase tracking-widest mb-0.5">${f.label}</p>
      <p class="text-[10px] font-bold uppercase tracking-wider">${f.value || '--'}</p>
    </div>
  `).join('');
}

function renderHotspots(entry, container) {
  if (!container) return;
  
  // Remove existing buttons
  container.querySelectorAll('.hotspot-btn').forEach(el => el.remove());

  const imgs = entry.images || [{src: entry.imageUrl}];
  const currentImgObj = imgs[AppState.currentImageIndex];
  const hotspots = currentImgObj.hotspots || entry.hotspots || [];

  const hotspotsContainer = $('active-entry-hotspots');
  if (hotspotsContainer) hotspotsContainer.innerHTML = '';

  hotspots.forEach((spot, i) => {
    // Floating Button
    const btn = document.createElement('button');
    btn.className = 'hotspot-btn';
    btn.style.left = spot.x + '%';
    btn.style.top = spot.y + '%';
    btn.setAttribute('data-index', i);
    btn.innerHTML = '<div class="hotspot-dot"></div>';
    container.appendChild(btn);

    // Sidebar Info Box
    if (hotspotsContainer) {
      const box = document.createElement('div');
      box.className = 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-3';
      box.setAttribute('data-hotspot-index', i);
      box.innerHTML = `
        <p class="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-60">${spot.label}</p>
        <p class="text-[10px] leading-relaxed uppercase tracking-tight">${spot.description}</p>
      `;
      hotspotsContainer.appendChild(box);
    }
  });
}

function renderRelatedEntries(entry, archiveData, callbacks) {
  const container = $('related-grid');
  if (!container) return;

  const currentTags = Object.values(entry.tags).flat();
  const scored = archiveData
    .filter(e => e && e.id && e.id !== entry.id)
    .map(e => {
      let score = 0;
      if (e.tags && entry.tags) {
        const currentTags = Object.values(entry.tags).flat();
        const targetTags = Object.values(e.tags).flat();
        targetTags.forEach(t => { if (currentTags.includes(t)) score++; });
      }
      return { entry: e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  container.innerHTML = '';
  scored.forEach(item => {
    const card = document.createElement('div');
    card.className = 'group cursor-crosshair';
    card.innerHTML = `
      <div class="aspect-[3/4] overflow-hidden border border-black/10 dark:border-white/10 mb-2">
        <img src="${resolveImgSrc(item.entry.images && item.entry.images[0], item.entry.imageUrl)}" 
             class="w-full h-full object-cover transition-all duration-500 scale-100 group-hover:scale-105"
             onerror="this.src='${BROKEN_ASSET}'; this.classList.add('broken-asset');" />
      </div>
      <p class="text-[8px] font-bold uppercase tracking-widest opacity-60">${item.entry.tags.brand}</p>
    `;
    card.addEventListener('click', () => openDetail(item.entry.id, 0, archiveData, callbacks));
    container.appendChild(card);
  });
}

