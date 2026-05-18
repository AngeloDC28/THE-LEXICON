/**
 * search-engine.js
 * Logic for filtering entries and interacting with the taxonomy system.
 */

import { $ } from './core-utils.js';
import { AppState, taxonomyData } from './core-state.js';
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
  // Tags can be single-value (era, brand) or pipe-separated multi-value
  // (politics, theories, materials, anatomy, etc.). An entry matches a filter
  // if the filter value equals the whole tag OR appears as one of its
  // ' | '-separated parts (trim-tolerant).
  entries = entries.filter(entry => {
    if (!entry.tags) return false;
    for (const [key, val] of Object.entries(AppState.filters)) {
      if (!val) continue;
      const tag = entry.tags[key];
      if (!tag) return false;
      if (tag === val) continue;
      const parts = tag.split('|').map(s => s.trim());
      if (!parts.includes(val)) return false;
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

  // Render order matches the user's intended layout: two columns per row,
  // last cell ("Format & Medium") spans both columns.
  const types = [
    { key: 'brand',     label: t('tax_brand') },
    { key: 'era',       label: t('tax_era') },
    { key: 'politics',  label: t('tax_politics') },
    { key: 'theories',  label: t('tax_theories') },
    { key: 'gender',    label: t('tax_gender') },
    { key: 'materials', label: t('tax_materials') },
    { key: 'geography', label: t('tax_geography') },
    { key: 'anatomy',   label: t('tax_anatomy') },
    { key: 'format',    label: t('tax_format'), span: true }
  ];

  container.innerHTML = types.map(type => {
    const isActive = AppState.activeTaxonomy === type.key;
    const isFiltered = AppState.filters && AppState.filters[type.key];
    const activeClass = isActive
      ? 'bg-black text-white dark:bg-white dark:text-black'
      : (isFiltered ? 'bg-acid text-black' : '');
    const spanClass = type.span ? 'taxonomy-cell--full' : '';
    const activeLabel = isFiltered ? ` <span class="taxonomy-cell-filter">· ${getTranslation(AppState.filters[type.key], lang)}</span>` : '';
    return `<button
      type="button"
      class="taxonomy-cell ${spanClass} ${activeClass}"
      data-taxonomy-type="${type.key}"
      aria-pressed="${isActive}"
    >${type.label}${activeLabel}</button>`;
  }).join('');
}

export function renderTaxonomySub(callbacks) {
  const container = $('taxonomy-sub');
  const grid = $('taxonomy-grid');
  if (!container || !grid) return;

  const type = AppState.activeTaxonomy;
  if (!type || !taxonomyData[type]) {
    container.classList.add('hidden');
    return;
  }

  // Show sub-panel ABOVE the grid (grid stays visible — they're stacked).
  container.classList.remove('hidden');

  const values = taxonomyData[type];
  const lang = AppState.language;
  const currentFilter = AppState.filters[type];
  container.innerHTML = `
    <div class="taxonomy-sub-header flex items-center justify-between gap-3 mb-3 pb-2 border-b border-black/10 dark:border-white/10">
      <span class="text-[10px] font-bold tracking-[0.2em] uppercase opacity-70">
        ${getTranslation('tax_' + type, lang)}${currentFilter ? ` <span class="opacity-50 font-normal normal-case tracking-normal">· ${getTranslation(currentFilter, lang)}</span>` : ''}
      </span>
      <button class="text-[9px] font-mono tracking-widest uppercase opacity-60 hover:opacity-100 border border-current px-2 py-1 transition-opacity" data-taxonomy-back="1" aria-label="Close filter panel">[ Close ]</button>
    </div>
    <div class="taxonomy-sub-values flex flex-wrap gap-1.5">
      ${currentFilter ? `<button
        class="taxonomy-val-btn px-2.5 py-1.5 text-[10px] tracking-wider uppercase font-mono border border-acid bg-acid text-black hover:opacity-80 transition-opacity"
        data-taxonomy-type="${type}"
        data-taxonomy-val="${currentFilter}"
        title="Clear this filter"
      >× ${getTranslation('btn_clear', lang) || 'Clear'}</button>` : ''}
      ${values.map(val => {
        const isActive = currentFilter === val;
        if (isActive) return '';
        return `<button
          class="taxonomy-val-btn px-2.5 py-1.5 text-[10px] tracking-wider uppercase font-mono border border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
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
