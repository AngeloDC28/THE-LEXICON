/**
 * ui-extras.js
 * Timeline matrix, filter chips, and metadata.
 */

import { $, resolveImgSrc, imgAttrs, webpSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';
import { invalidateSearchCache } from './search-engine.js';

export function renderTimeline(archiveData, callbacks) {
  const container = $('timeline-matrix');
  if (!container) return;

  const years = {};
  archiveData.forEach(e => {
    if (!years[e.year]) years[e.year] = [];
    years[e.year].push(e);
  });

  const sortedYears = Object.keys(years).sort((a, b) => a - b);

  // Insert gap markers between non-consecutive years (bug 7.1b)
  const items = [];
  sortedYears.forEach((year, idx) => {
    if (idx > 0) {
      const gap = Number(year) - Number(sortedYears[idx - 1]) - 1;
      if (gap > 0) items.push({ type: 'gap', gap });
    }
    items.push({ type: 'year', year, entries: years[year] });
  });

  container.innerHTML = items.map(item => {
    if (item.type === 'gap') {
      return `<div class="flex-shrink-0 w-16 h-full flex flex-col items-center justify-center opacity-20 border-r border-black/10 dark:border-white/10">
        <div class="text-[7px] font-mono uppercase tracking-widest writing-mode-vertical" style="writing-mode:vertical-rl;transform:rotate(180deg)">· · · ${item.gap} ${item.gap === 1 ? 'yr' : 'yrs'} · · ·</div>
      </div>`;
    }
    const { year, entries } = item;
    return `
      <div class="flex-shrink-0 w-64 h-full border-r border-black/10 dark:border-white/10 flex flex-col p-4 bg-overlay/20 dark:bg-darkSurface/20">
        <div class="flex justify-between items-baseline mb-6 shrink-0">
          <h3 class="text-3xl font-bold font-mono tracking-tighter text-acid">${year}</h3>
          <span class="text-[8px] uppercase tracking-widest opacity-40">${entries.length} ${entries.length === 1 ? getTranslation('label_artifact_singular', AppState.language) : getTranslation('label_artifacts', AppState.language)}</span>
        </div>
        <div class="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          ${entries.map((e, i) => `
            <div class="timeline-item group relative aspect-[3/4] overflow-hidden border border-black/5 dark:border-white/5 cursor-crosshair bg-black/5 dark:bg-white/5 opacity-0"
                 data-id="${e.id}" role="button" tabindex="0"
                 aria-label="${getTranslation(e.tags.brand, AppState.language)} ${e.year} — ${getTranslation(e.title, AppState.language)}"
                 style="transition: all 0.6s ease; transition-delay: ${Math.min(i * 0.1, 1.5)}s">
              <picture>
                <source type="image/webp" srcset="${resolveImgSrc({src: webpSrc(e.images && e.images[0])})}">
                <img src="${resolveImgSrc(e.images && e.images[0])}"${imgAttrs(e.images && e.images[0])}
                     alt="${getTranslation(e.tags.brand, AppState.language)} ${e.year}"
                     class="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-0"
                     loading="lazy"
                     onload="this.classList.add('loaded'); this.closest('.timeline-item').classList.add('loaded');"
                     onerror="this.onerror=null;this.src='${BROKEN_ASSET}';this.classList.add('loaded');this.closest('.timeline-item').classList.add('loaded');this.classList.add('broken-asset');" />
              </picture>
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                <p class="text-[var(--t-mono-xs)] text-white font-bold uppercase tracking-wider truncate">${getTranslation(e.tags.brand, AppState.language)}</p>
                <p class="text-[7px] text-white/60 uppercase truncate">${getTranslation(e.title, AppState.language)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Attach Listeners
  container.querySelectorAll('.timeline-item').forEach(el => {
    const activate = () => { if (callbacks && callbacks.openDetail) callbacks.openDetail(el.dataset.id); };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

export function renderFilterChips(callbacks) {
  const container = $('filter-chips');
  if (!container) return;
  
  let chips = [];
  if (AppState.searchQuery) {
    chips.push({ label: `${getTranslation('search_prefix', AppState.language)}: ${AppState.searchQuery}`, type: 'search', value: '' });
  }

  const yr = AppState.yearRange || { min: 1980, max: 2025 };
  if (yr.min > 1980 || yr.max < 2025) {
    chips.push({ label: `YEAR: ${yr.min}–${yr.max}`, type: 'yearRange', value: '' });
  }

  Object.entries(AppState.filters).forEach(([type, val]) => {
    if (!val) return;
    const translatedType = getTranslation(`tax_${type}`, AppState.language);
    val.split('|').map(s => s.trim()).filter(Boolean).forEach(v => {
      const translatedVal = getTranslation(v, AppState.language);
      chips.push({ label: `${translatedType.toUpperCase()}: ${translatedVal}`, type, value: v });
    });
  });

  if (chips.length === 0) {
    container.innerHTML = `<span class="text-[8px] opacity-20 uppercase tracking-widest">${getTranslation('no_active_filters', AppState.language)}</span>`;
    return;
  }

  container.innerHTML = chips.map(c => `
    <button type="button" class="filter-chip focus-ring bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-80 transition-opacity"
            data-type="${c.type}" data-value="${c.value}"
            aria-label="Remove filter: ${c.label}">
      ${c.label}
      <span aria-hidden="true" class="opacity-50">✕</span>
    </button>
  `).join('');

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'search') {
        AppState.searchQuery = '';
        if ($('search-input')) $('search-input').value = '';
      } else if (type === 'yearRange') {
        AppState.yearRange = { min: 1980, max: 2025 };
        invalidateSearchCache();
      } else {
        const removedVal = btn.dataset.value;
        const current = AppState.filters[type] || '';
        const remaining = current.split('|').map(s => s.trim()).filter(v => v && v !== removedVal);
        AppState.filters[type] = remaining.length ? remaining.join('|') : null;
      }
      // switchView('grid') already calls callbacks.onUpdate → refreshUI(),
      // so no separate lexicon-refresh dispatch is needed. Removing it
      // eliminates a double-refresh on every chip click.
      if (callbacks && callbacks.switchView) callbacks.switchView('grid');
    });
  });
}

export function updateMetaForEntry(entry) {
  if (!entry) return;
  const title = `${entry.tags.brand} ${entry.year} — THE LEXICON`;
  document.title = title;

  // OG Tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = title;

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.content = `Analyzing architectural details of ${entry.tags.brand} (${entry.year}) within the forensic archival database.`;

  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) ogImg.content = resolveImgSrc(entry.images && entry.images[0]);

  // Twitter Tags
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.content = title;

  const twImg = document.querySelector('meta[name="twitter:image"]');
  if (twImg) twImg.content = resolveImgSrc(entry.images && entry.images[0]);
}

export function resetMeta() {
  document.title = 'THE LEXICON';
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = 'THE LEXICON';
}

export function extractAccentColor(imgEl) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const glow = $('accent-glow');
    if (glow) glow.style.boxShadow = `inset 0 0 120px 40px rgba(${r},${g},${b},0.3)`;
  } catch(e) { /* CORS */ }
}
