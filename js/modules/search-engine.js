/**
 * search-engine.js
 * Logic for filtering entries and interacting with the taxonomy system.
 */

import { $ } from './core-utils.js';
import { AppState, taxonomyData } from './core-state.js';
import { getTranslation } from './translations.js';
import { getTranslation } from './translations.js';

let searchCache = new Map();
let lastCacheKey = null;

export function getFilteredEntries(archiveData) {
  const q = (AppState.searchQuery || '').toLowerCase();
  const folId = AppState.activeFolderId;
  const filterKey = JSON.stringify(AppState.filters);
  const cacheKey = `${q}|${folId}|${filterKey}|${AppState.sortMode}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  let entries = archiveData;

  // 1. Filter by folder if active
  if (folId) {
    const fol = AppState.archivalFolders.find(v => v.id === folId);
    if (fol) {
      entries = entries.filter(e => fol.lookIds.includes(e.id));
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

  // 4. Sort
  const mode = AppState.sortMode || 'default';
  if (mode === 'year-asc')  entries = [...entries].sort((a, b) => (a.year || 0) - (b.year || 0));
  else if (mode === 'year-desc') entries = [...entries].sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (mode === 'brand-az')  entries = [...entries].sort((a, b) => (a.tags?.brand || '').localeCompare(b.tags?.brand || ''));

  searchCache.set(cacheKey, entries);
  if (searchCache.size > 20) searchCache.delete(searchCache.keys().next().value);
  return entries;
}

export function renderTaxonomyGrid() {
  const container = $('taxonomy-grid');
  if (!container) return;

  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);

  const types = [
    { key: 'brand',     label: t('tax_brand') },
    { key: 'era',       label: t('tax_era') },
    { key: 'politics',  label: t('tax_politics') },
    { key: 'theories',  label: t('tax_theories') },
    { key: 'gender',    label: t('tax_gender') },
    { key: 'materials', label: t('tax_materials') },
    { key: 'geography', label: t('tax_geography') },
    { key: 'anatomy',   label: t('tax_anatomy') },
    { key: 'format',    label: t('tax_format') }
  ];

  container.innerHTML = types.map(type => {
    const isActive = AppState.activeTaxonomy === type.key;
    const activeClass = isActive ? 'bg-black text-white dark:bg-white dark:text-black' : '';
    return `<button
      class="taxonomy-btn border border-current px-3 py-1 text-xs tracking-widest uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors ${activeClass}"
      data-taxonomy-type="${type.key}"
    >${type.label}</button>`;
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
    <div class="taxonomy-sub-header flex items-center gap-4 mb-2">
      <span class="text-xs tracking-widest uppercase opacity-60">REFINE BY: ${type.toUpperCase()}</span>
      <button class="text-xs tracking-widest uppercase border border-current px-2 py-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors" data-taxonomy-back="1">&larr; BACK</button>
    </div>
    <div class="taxonomy-sub-values flex flex-wrap gap-2">
      ${values.map(val => {
        const isActive = AppState.filters[type] === val;
        const activeClass = isActive ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-black/30 dark:border-white/30';
        return `<button
          class="taxonomy-val-btn border border-current px-3 py-1 text-xs tracking-widest uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors ${activeClass}"
          data-taxonomy-type="${type}"
          data-taxonomy-val="${val}"
        >${getTranslation(val, AppState.language)}</button>`;
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
