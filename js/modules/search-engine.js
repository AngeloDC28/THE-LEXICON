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
  const filters = JSON.stringify(AppState.filters);
  const cacheKey = `${q}|${volId}|${filters}`;

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
    for (const [key, val] of Object.entries(filters)) {
      if (val && entry.tags[key] !== val) return false;
    }
    return true;
  });

  // 3. Filter by search query
  if (q) {
    entries = entries.filter(entry => {
      const searchable = [
        entry.id,
        entry.title,
        entry.year,
        entry.season,
        entry.description,
        ...Object.values(entry.tags),
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
    { key: 'brand', label: 'LABELS', code: '01' },
    { key: 'era', label: 'CHRONOLOGY', code: '02' },
    { key: 'politics', label: 'POLITICS', code: '03' },
    { key: 'theories', label: 'THEORIES', code: '04' },
    { key: 'gender', label: 'IDENTITY', code: '05' },
    { key: 'materials', label: 'MATERIALITY', code: '06' },
    { key: 'geography', label: 'GEOGRAPHY', code: '07' }
  ];

  container.innerHTML = types.map(t => {
    const isActive = AppState.activeTaxonomy === t.key;
    const activeClass = isActive ? 'bg-black text-white dark:bg-white dark:text-black' : '';
    return `
      <button class="taxonomy-item p-4 text-left hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all ${activeClass}" data-type="${t.key}">
        <span class="text-[8px] uppercase tracking-widest opacity-40 block mb-1">CAT_${t.code}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider">${t.label}</span>
      </button>
    `;
  }).join('');
}

export function renderTaxonomySub(callbacks) {
  const container = $('taxonomy-sub');
  if (!container) return;

  const type = AppState.activeTaxonomy;
  if (!type || !taxonomyData[type]) {
    container.innerHTML = '<div class="col-span-full py-10 text-center opacity-20 text-[8px] uppercase tracking-widest">Select category to refine search</div>';
    return;
  }

  const values = taxonomyData[type];
  container.innerHTML = values.map(val => {
    const isActive = AppState.filters[type] === val;
    const activeClass = isActive ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-black/10 dark:border-white/10';
    return `
      <button class="taxonomy-pill text-[9px] font-bold uppercase tracking-widest p-2 border transition-all text-left truncate ${activeClass}" data-value="${val}">
        ${val}
      </button>
    `;
  }).join('');
}

export function setActiveTaxonomy(type) {
  if (AppState.activeTaxonomy === type) {
    AppState.activeTaxonomy = null;
  } else {
    AppState.activeTaxonomy = type;
  }
}
