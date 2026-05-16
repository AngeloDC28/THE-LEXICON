/**
 * render-grid.js
 * Rendering logic for the image grid.
 * FIX: Grid image src now uses resolveImgSrc() which anchors paths to
 * window.location.origin, fixing the broken image issue where relative paths
 * resolved incorrectly depending on the current URL.
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
  const cells  = document.querySelectorAll('#image-grid .grid-cell');
  if (!cells.length || !rootEl) return;
  if (!window.matchMedia('(max-width: 767px)').matches) {
    cells.forEach(c => c.classList.remove('grid-cell--focus'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.intersectionRatio >= 0.5) en.target.classList.add('grid-cell--focus');
      else en.target.classList.remove('grid-cell--focus');
    });
  }, { root: rootEl, rootMargin: '-20% 0px -20% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
  cells.forEach(cell => observer.observe(cell));
  setGridIntersectionObserver(observer);
}

export function renderImageGrid(archiveData, callbacks) {
  const entries = getFilteredEntries(archiveData);
  const grid    = $('image-grid');
  if (!grid) return;

  const folIndicator = $('active-folder-indicator');
  const folName      = $('active-folder-name');
  if (AppState.activeFolderId) {
    if (folIndicator) folIndicator.classList.remove('hidden');
    const fol = AppState.archivalFolders.find(v => v.id === AppState.activeFolderId);
    if (folName) folName.textContent = fol ? fol.name : 'Unknown Folder';
  } else {
    if (folIndicator) folIndicator.classList.add('hidden');
  }

  if (entries.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-32 text-center">
        <div class="text-xs font-mono uppercase tracking-widest text-black/40 dark:text-white/40 mb-4">Null Set Detected</div>
        <div class="text-[10px] font-mono text-black/30 dark:text-white/30 mb-6">Adjust filters or search parameters</div>
        <button id="btn-reset-filters-null" class="border border-black dark:border-white text-[10px] font-mono uppercase tracking-widest px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-colors">${getTranslation('btn_reset_system', AppState.language)}</button>
      </div>`;
    $('btn-reset-filters-null')?.addEventListener('click', () => {
      AppState.filters = { brand: null, era: null, politics: null, theories: null,
        gender: null, materials: null, geography: null, format: null, anatomy: null };
      AppState.searchQuery = '';
      if ($('search-input')) $('search-input').value = '';
      if (callbacks && callbacks.onUpdate) callbacks.onUpdate();
    });
    return;
  }

  let html = '';
  entries.forEach((entry, index) => {
    const imgs = entry.images || [{ src: entry.imageUrl }];
    imgs.forEach((imgObj, i) => {
      // FIX: use resolveImgSrc so all paths become absolute URLs
      const src   = resolveImgSrc(imgObj, entry.imageUrl);
      const delay = (index % 10) * 0.05;
      const brand = (entry.tags && entry.tags.brand)
        ? getTranslation(entry.tags.brand, AppState.language)
        : getTranslation('brand_unknown', AppState.language);

      html += `
        <div class="grid-cell cursor-crosshair group relative overflow-hidden"
             data-entry-id="${entry.id}"
             data-img-index="${i}"
             tabindex="0"
             role="button"
             aria-label="${brand} ${entry.year || ''}"
             style="animation-delay: ${delay}s">
          <img
            src="${src}"
            alt="${entry.tags?.brand || entry.id}"
            loading="lazy"
            decoding="async"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onload="this.classList.add('loaded')" onerror="this.src='${BROKEN_ASSET}'; this.classList.add('loaded')">
          <div class="grid-cell-meta absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="text-[9px] font-mono uppercase tracking-widest text-white">${brand}</div>
            <div class="text-[8px] font-mono text-white/60">${entry.year || '----'} // ${entry.season || 'ARCHIVE'}</div>
          </div>
        </div>`;
    });
  });

  grid.innerHTML = html;
  setupGridIntersectionObserver();
}

export function renderEntryList(archiveData, callbacks) {
  const container = $('entry-list');
  if (!container) return;
  const filtered = getFilteredEntries(archiveData);
  const total    = archiveData.length;
  const count    = filtered.length;

  const totalLabel = $('index-panel-title');
  if (totalLabel) {
    const t = (key) => getTranslation(key, AppState.language);
    totalLabel.textContent = `${t('index_title')} / ${pad(count)} OF ${pad(total)}`;
  }

  if (count === 0) {
    container.innerHTML = '<p class="text-[10px] font-mono text-black/40 dark:text-white/40 p-4">No results</p>';
    return;
  }

  container.innerHTML = filtered.map(entry => {
    const brand = (entry.tags && entry.tags.brand) ? entry.tags.brand : 'UNKNOWN BRAND';
    const year  = entry.year  || '----';
    const title = entry.title || 'Untitled Entry';
    return `
      <div class="entry-item cursor-crosshair border-b border-black/5 dark:border-white/5 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
           data-id="${entry.id}">
        <div class="text-[10px] font-mono uppercase tracking-widest font-medium">${brand}</div>
        <div class="text-[9px] font-mono text-black/40 dark:text-white/40 mt-0.5">
          <span>${year}</span>
        </div>
        <div class="text-[9px] font-mono text-black/60 dark:text-white/60 mt-0.5 truncate">${title}</div>
      </div>`;
  }).join('');
}
