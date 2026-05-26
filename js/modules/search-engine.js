/**
 * search-engine.js
 * Logic for filtering entries and interacting with the taxonomy system.
 */

import { $ } from './core-utils.js';
import { AppState, taxonomyData } from './core-state.js';
import { getTranslation } from './translations.js';

let searchCache = new Map();

/** Call after any folder mutation (create/delete/save/remove) so the
 * filtered-entry cache doesn't return stale results when an entry is
 * added to or removed from the currently active folder. */
export function invalidateSearchCache() {
  searchCache.clear();
}

export function getFilteredEntries(archiveData) {
  const q = (AppState.searchQuery || '').toLowerCase();
  const folId = AppState.activeFolderId;
  const filterKey = JSON.stringify(AppState.filters);
  // Fold folder membership into the cache key so adding/removing entries
  // from the active folder produces a different key and forces a recompute.
  const folRev = folId
    ? (AppState.archivalFolders.find(f => f.id === folId)?.lookIds || []).length
    : 0;
  const yr = AppState.yearRange || { min: 1980, max: 2025 };
  const bookmarksOnly = !!AppState.bookmarksOnly;
  const cacheKey = `${q}|${folId}|${folRev}|${filterKey}|${AppState.sortMode}|${yr.min}-${yr.max}|bm:${bookmarksOnly}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  let entries = archiveData;

  // 1. Filter by folder if active. Guard lookIds in case a legacy or
  // imported folder document is missing the array.
  if (folId) {
    const fol = AppState.archivalFolders.find(v => v.id === folId);
    if (fol) {
      const ids = fol.lookIds || [];
      entries = entries.filter(e => ids.includes(e.id));
    }
  }

  // 1b. Bookmarks-only filter (independent of folders).
  if (bookmarksOnly) {
    try {
      const bm = JSON.parse(localStorage.getItem('lexicon-bookmarks') || '[]');
      const bmSet = new Set(bm);
      entries = entries.filter(e => bmSet.has(e.id));
    } catch (e) { /* localStorage unavailable */ }
  }

  // 2a. Filter by year range (if narrowed from defaults)
  if (yr.min > 1980 || yr.max < 2025) {
    entries = entries.filter(e => {
      const y = e.year;
      return y && y >= yr.min && y <= yr.max;
    });
  }

  // 2. Filter by taxonomy tags
  // AppState.filters[key] is a pipe-separated string of selected values (multi-select).
  // An entry matches if its tag value equals ANY of the selected filter values,
  // checking both the whole tag and its own pipe-separated parts.
  entries = entries.filter(entry => {
    if (!entry.tags) return false;
    for (const [key, val] of Object.entries(AppState.filters)) {
      if (!val) continue;
      const tag = entry.tags[key];
      if (!tag) return false;
      const filterVals = val.split('|').map(s => s.trim());
      const tagParts = tag.split('|').map(s => s.trim());
      if (!filterVals.some(fv => fv === tag || tagParts.includes(fv))) return false;
    }
    return true;
  });

  // 3. Filter by search query (supports field operators: tag:, brand:, year:, designer:, era:, format:)
  if (q) {
    // Extract field operators
    const opRe = /(tag|brand|year|designer|era|format|movement):([^\s]+)/gi;
    const ops = {};
    let freeText = q;
    let m;
    while ((m = opRe.exec(q)) !== null) {
      ops[m[1].toLowerCase()] = m[2].toLowerCase();
      freeText = freeText.replace(m[0], '').trim();
    }

    entries = entries.filter(entry => {
      const t = entry.tags || {};
      if (ops.year   && String(entry.year || '') !== ops.year) return false;
      if (ops.brand  && !(t.brand || '').toLowerCase().includes(ops.brand)) return false;
      if (ops.designer && !(t.brand || '').toLowerCase().includes(ops.designer)) return false;
      if (ops.tag    && !(t.politics || '').toLowerCase().includes(ops.tag)) return false;
      if (ops.era    && !(t.era || '').toLowerCase().includes(ops.era)) return false;
      if (ops.format && !(t.format || '').toLowerCase().includes(ops.format)) return false;
      if (ops.movement && !(t.theories || '').toLowerCase().includes(ops.movement)) return false;
      if (freeText) {
        const searchable = [
          entry.id || '', entry.title || '',
          entry.year ? String(entry.year) : '',
          entry.season || '', entry.description || '',
          ...Object.values(t), ...Object.values(entry.notes || {})
        ].join(' ').toLowerCase();
        if (!searchable.includes(freeText)) return false;
      }
      return true;
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
    const filterVal = AppState.filters && AppState.filters[type.key];
    const isFiltered = !!filterVal;
    const activeValsCount = isFiltered ? filterVal.split('|').filter(Boolean).length : 0;
    const activeClass = isActive
      ? 'bg-black text-white dark:bg-white dark:text-black'
      : (isFiltered ? 'bg-acid text-black' : '');
    const spanClass = type.span ? 'taxonomy-cell--full' : '';
    const activeLabel = isFiltered
      ? ` <span class="taxonomy-cell-filter">· ${activeValsCount > 1 ? `${activeValsCount} selected` : getTranslation(filterVal, lang)}</span>`
      : '';
    return `<button
      type="button"
      class="taxonomy-cell ${spanClass} ${activeClass}"
      data-taxonomy-type="${type.key}"
      aria-pressed="${isActive}"
      aria-current="${isFiltered ? 'true' : 'false'}"
    >${type.label}${activeLabel}</button>`;
  }).join('');
}

export function renderTaxonomySub(callbacks, archiveData) {
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
  const activeVals = currentFilter ? currentFilter.split('|').map(s => s.trim()).filter(Boolean) : [];

  // Build per-value entry count map if archiveData is provided
  const countMap = new Map();
  if (archiveData && archiveData.length) {
    values.forEach(val => {
      const count = archiveData.filter(e => {
        const tag = e.tags?.[type] || '';
        return tag === val || tag.split('|').map(s => s.trim()).includes(val);
      }).length;
      if (count > 0) countMap.set(val, count);
    });
  }

  container.innerHTML = `
    <div class="taxonomy-sub-header flex items-center justify-between gap-3 mb-3 pb-2 border-b border-black/10 dark:border-white/10">
      <span class="text-[var(--t-chrome-xs)] font-medium tracking-[0.2em] uppercase opacity-70">
        ${getTranslation('tax_' + type, lang)}${activeVals.length ? ` <span class="opacity-50 font-normal normal-case tracking-normal">· ${activeVals.length} selected</span>` : ''}
      </span>
      <div class="flex items-center gap-2">
        ${activeVals.length ? `<button type="button" class="focus-ring text-[var(--t-chrome-xs)] font-mono tracking-widest uppercase opacity-60 hover:opacity-100 border border-acid text-acid px-2 py-1 transition-opacity" data-taxonomy-clear="${type}" aria-label="Clear all ${type} filters">[ Clear all ]</button>` : ''}
        <button type="button" class="focus-ring text-[var(--t-chrome-xs)] font-mono tracking-widest uppercase opacity-60 hover:opacity-100 border border-current px-2 py-1 transition-opacity" data-taxonomy-back="1" aria-label="Close filter panel">[ Close ]</button>
      </div>
    </div>
    <div class="taxonomy-sub-values flex flex-wrap gap-1.5">
      ${values.map(val => {
        const isActive = activeVals.includes(val);
        const count = countMap.get(val);
        const countBadge = count ? ` <span class="opacity-50 text-[8px] font-normal normal-case">${count}</span>` : '';
        const activeClass = isActive
          ? 'border-acid bg-acid text-black hover:opacity-80'
          : 'border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black';
        const zeroClass = count === 0 ? ' opacity-30' : '';
        return `<button type="button"
          class="taxonomy-val-btn px-2.5 py-1.5 text-[var(--t-mono-xs)] tracking-wider uppercase font-mono border transition-colors ${activeClass}${zeroClass}"
          data-taxonomy-type="${type}"
          data-taxonomy-val="${val}"
          aria-pressed="${isActive}"
          ${count === 0 ? 'disabled aria-disabled="true"' : ''}
        >${isActive ? '✓ ' : ''}${getTranslation(val, AppState.language)}${countBadge}</button>`;
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
