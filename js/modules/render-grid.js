/**
 * render-grid.js
 * Rendering logic for the image grid.
 */

import { $, pad, resolveImgSrc } from './core-utils.js';
import { AppState, gridIntersectionObserver, setGridIntersectionObserver } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';

export function setupGridIntersectionObserver() {
  if (gridIntersectionObserver) {
    gridIntersectionObserver.disconnect();
    setGridIntersectionObserver(null);
  }
  const rootEl = $('grid-view');
  const cells = document.querySelectorAll('#main-grid .grid-cell');
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
  const grid = $('main-grid');
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
        <p class="text-[8px] uppercase tracking-widest">Adjust filters or search parameters</p>
      </div>
    `;
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
            loading="lazy"
          />
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
            <p class="text-white text-[10px] font-bold uppercase tracking-widest font-mono">${entry.tags.brand}</p>
            <p class="text-white/60 text-[8px] uppercase tracking-widest font-mono">${entry.year} // ${entry.season || 'ARCHIVE'}</p>
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

export function renderEntryList(archiveData) {
  // Legacy support or alternative view if needed
  console.warn('renderEntryList is currently deprecated in the unified grid layout.');
}
