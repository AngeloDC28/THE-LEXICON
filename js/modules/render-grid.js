/**
 * render-grid.js
 * Rendering logic for the image grid.
 */

import { $, pad, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState, gridIntersectionObserver, setGridIntersectionObserver } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';
import { getTranslation } from './translations.js';

export function setupGridIntersectionObserver() {
  if (gridIntersectionObserver) {
    gridIntersectionObserver.disconnect();
    setGridIntersectionObserver(null);
  }
  const rootEl = $('grid-view');
  const cells = document.querySelectorAll('#image-grid .grid-cell');
  if (!cells.length || !rootEl) return;
  
  if (!window.matchMedia('(max-width: 767px)').matches) {
    cells.forEach(c => c.classList.remove('grid-cell--focus'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.intersectionRatio >= 0.5) {
        en.target.classList.add('grid-cell--focus');
      } else {
        en.target.classList.remove('grid-cell--focus');
      }
    });
  }, {
    root: rootEl,
    rootMargin: '-20% 0px -20% 0px',
    threshold: [0, 0.25, 0.5, 0.75, 1],
  });

  cells.forEach(cell => observer.observe(cell));
  setGridIntersectionObserver(observer);
}

export function renderImageGrid(archiveData, callbacks) {
  const entries = getFilteredEntries(archiveData);
  const grid = $('image-grid');
  if (!grid) return;

  // Handle Volume Indicator
  const volIndicator = $('active-volume-indicator');
  const volName = $('active-volume-name');
  if (AppState.activeVolumeId) {
    if (volIndicator) volIndicator.classList.remove('hidden');
    const vol = AppState.archivalVolumes.find(v => v.id === AppState.activeVolumeId);
    if (volName) volName.textContent = vol ? vol.name : 'Unknown Volume';
  } else {
    if (volIndicator) volIndicator.classList.add('hidden');
  }

  if (entries.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-40 flex flex-col items-center justify-center opacity-40">
        <p class="text-[10px] uppercase tracking-[0.3em] mb-2">Null Set Detected</p>
        <p class="text-[8px] uppercase tracking-widest mb-6">Adjust filters or search parameters</p>
        <button id="btn-reset-filters-null" class="text-[9px] font-bold border border-black dark:border-white px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-all uppercase tracking-widest">
          Reset System
        </button>
      </div>
    `;
    
    // Attach reset listener
    $('btn-reset-filters-null')?.addEventListener('click', () => {
      AppState.filters = { brand: null, era: null, politics: null, theories: null, gender: null, materials: null, geography: null };
      AppState.searchQuery = '';
      if ($('search-input')) $('search-input').value = '';
      if (callbacks && callbacks.onUpdate) callbacks.onUpdate();
    });
    return;
  }

  let html = '';
  entries.forEach((entry) => {
    const imgs = entry.images || [{src: entry.imageUrl}];
    imgs.forEach((imgObj, i) => {
      const src = resolveImgSrc(imgObj, entry.imageUrl);
      html += `
        <div class="group grid-cell relative aspect-[3/4] overflow-hidden border-r border-b border-black/10 dark:border-white/10 cursor-crosshair" 
             data-entry-id="${entry.id}" data-img-index="${i}">
          <img
            src="${src}"
            alt="${entry.id}"
            class="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0 group-hover:scale-110"
            onload="this.classList.add('loaded')"
            onerror="console.error('LEXICON_ASSET_LOAD_FAILURE:', this.src); this.src='${BROKEN_ASSET}'; this.classList.add('broken-asset');"
          />
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
            <p class="text-white text-[10px] font-bold uppercase tracking-widest font-mono">${(entry.tags && entry.tags.brand) ? entry.tags.brand : 'UNKNOWN'}</p>
            <p class="text-white/60 text-[8px] uppercase tracking-widest font-mono">${entry.year || '----'} // ${entry.season || 'ARCHIVE'}</p>
          </div>
        </div>
      `;

    });
  });

  grid.innerHTML = html;
  
  // Attach Click Events
  grid.querySelectorAll('.grid-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const id = cell.dataset.entryId;
      const idx = parseInt(cell.dataset.imgIndex);
      if (callbacks && callbacks.openDetail) {
        callbacks.openDetail(id, idx);
      }
    });
  });

  setupGridIntersectionObserver();
}

export function renderEntryList(archiveData, callbacks) {
  const container = $('entry-list');
  if (!container) return;

  const filtered = getFilteredEntries(archiveData);
  const total = archiveData.length;
  const count = filtered.length;

  // Update total count labels
  const totalLabel = $('index-panel-title');
  if (totalLabel) {
    const t = (key) => getTranslation(key, AppState.language);
    totalLabel.textContent = `${t('index_title')} / ${pad(count)} OF ${pad(total)}`;
  }

  if (count === 0) {
    container.innerHTML = '<div class="p-8 text-center opacity-40 text-[10px] uppercase tracking-widest">No results</div>';
    return;
  }

  container.innerHTML = filtered.map(entry => {
    const brand = (entry.tags && entry.tags.brand) ? entry.tags.brand : 'UNKNOWN BRAND';
    const year = entry.year || '----';
    const title = entry.title || 'Untitled Entry';
    
    return `
      <div class="entry-item group px-4 py-3 border-b border-black/5 dark:border-white/5 cursor-crosshair hover:bg-black/5 dark:hover:bg-white/5 transition-colors" data-id="${entry.id}">
        <div class="flex justify-between items-baseline mb-1">
          <h4 class="text-[10px] font-bold uppercase tracking-wider group-hover:text-acid transition-colors">${brand}</h4>
          <span class="text-[8px] font-mono opacity-40">${year}</span>
        </div>
        <p class="text-[9px] opacity-60 uppercase tracking-tight line-clamp-1">${title}</p>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.entry-item').forEach(el => {
    el.addEventListener('click', () => {
      if (callbacks && callbacks.openDetail) {
        callbacks.openDetail(el.dataset.id);
      }
    });
  });
}
