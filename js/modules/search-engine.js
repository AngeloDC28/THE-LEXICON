/**
 * search-engine.js
 * Logic for filtering entries and interacting with the taxonomy system.
 */

import { $ } from './core-utils.js';
import { AppState, taxonomyData } from './core-state.js';

let searchCache = new Map();
let lastCacheKey = null;

export function getFilteredEntries(archiveData) {
  const q = (AppState.searchQuery || '').toLowerCase();
  const volId = AppState.activeVolumeId;
  const filterKey = JSON.stringify(AppState.filters);
  const cacheKey = `${q}|${volId}|${filterKey}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }
  
  let entries = archiveData;

  // 1. Filter by volume if active
  if (volId) {
    const vol = AppState.archivalVolumes.find(v => v.id === volId);
    if (vol) {
      entries = entries.filter(e => vol.lookIds.includes(e.id));
    }
  }

  // 2. Filter by taxonomy tags
  entries = entries.filter(entry => {
    if (!entry.tags) return false;
    for (const [key, val] of Object.entries(AppState.filters)) {
      if (val && entry.tags[key] !== val) return false;
    }
    return true;
  });

  // 3. Filter by search query
  if (q) {
    entries = entries.filter(entry => {
      const searchable = [
        entry.id || '',
        entry.title || '',
        entry.year ? String(entry.year) : '',
        entry.season || '',
        entry.description || '',
        ...(entry.tags ? Object.values(entry.tags) : []),
        ...(entry.notes ? Object.values(entry.notes) : [])
      ].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  searchCache.set(cacheKey, entries);
  // Optional: clear cache if it grows too large
  if (searchCache.size > 50) searchCache.clear();

  return entries;
}

export function renderTaxonomyGrid() {
  const container = $('taxonomy-grid');
  if (!container) return;

  const types = [
    { key: 'brand', label: 'BRANDS' },
    { key: 'era', label: 'ERA' },
    { key: 'politics', label: 'POLITICS' },
    { key: 'theories', label: 'THEORY' },
    { key: 'gender', label: 'IDENTITY' },
    { key: 'materials', label: 'MATERIALS' },
    { key: 'geography', label: 'LOCATION' },
    { key: 'anatomy', label: 'ANATOMY' },
    { key: 'format', label: 'FORMAT' }
  ];


  container.innerHTML = types.map(t => {
    const isActive = AppState.activeTaxonomy === t.key;
    const activeClass = isActive ? 'bg-black text-white dark:bg-white dark:text-black' : '';
    return `
      <button class="taxonomy-item p-4 text-left hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all ${activeClass}" data-type="${t.key}">
        <span class="text-[10px] font-bold uppercase tracking-wider">${t.label}</span>
      </button>
    `;
  }).join('');
}

export function renderTaxonomySub(callbacks) {
  const container = $('taxonomy-sub');
  const grid = $('taxonomy-grid');
  if (!container || !grid) return;

  const type = AppState.activeTaxonomy;
  if (!type || !taxonomyData[type]) {
    container.classList.add('hidden');
    grid.classList.remove('hidden');
    return;
  }

  // Show sub, hide grid
  container.classList.remove('hidden');
  grid.classList.add('hidden');

  const values = taxonomyData[type];
  container.innerHTML = `
    <div class="p-2 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
      <span class="text-[8px] font-bold uppercase tracking-widest opacity-60">REFINE_BY: ${type.toUpperCase()}</span>
      <button class="btn-back-taxonomy text-[8px] font-bold uppercase underline hover:no-underline" title="Back to main categories">[ BACK ]</button>
    </div>
    <div class="grid grid-cols-2 gap-0">
      ${values.map(val => {
        const isActive = AppState.filters[type] === val;
        const activeClass = isActive ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-black/5 dark:border-white/5';
        return `
          <button class="taxonomy-pill text-[9px] font-bold uppercase tracking-widest p-3 border transition-all text-left truncate ${activeClass}" data-value="${val}">
            ${val}
          </button>
        `;
      }).join('')}
    </div>
  `;
}


export function setActiveTaxonomy(type) {
  if (AppState.activeTaxonomy === type) {
    AppState.activeTaxonomy = null;
  } else {
    AppState.activeTaxonomy = type;
  }
}
