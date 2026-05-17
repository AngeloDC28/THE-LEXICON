/**
 * ui-extras.js
 * Timeline matrix, filter chips, and metadata.
 */

import { $, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

export function renderTimeline(archiveData, callbacks) {
  const container = $('timeline-matrix');
  if (!container) return;

  const years = {};
  archiveData.forEach(e => {
    if (!years[e.year]) years[e.year] = [];
    years[e.year].push(e);
  });

  const sortedYears = Object.keys(years).sort((a, b) => a - b);
  
  container.innerHTML = sortedYears.map(year => {
    const entries = years[year];
    return `
      <div class="flex-shrink-0 w-64 h-full border-r border-black/10 dark:border-white/10 flex flex-col p-4 bg-overlay/20 dark:bg-darkSurface/20">
        <div class="flex justify-between items-baseline mb-6 shrink-0">
          <h3 class="text-3xl font-bold font-mono tracking-tighter text-acid">${year}</h3>
          <span class="text-[8px] uppercase tracking-widest opacity-40">${entries.length} Artifacts</span>
        </div>
        <div class="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          ${entries.map((e, i) => `
            <div class="timeline-item group relative aspect-[3/4] overflow-hidden border border-black/5 dark:border-white/5 cursor-crosshair bg-black/5 dark:bg-white/5 opacity-0 translateY-10" 
                 data-id="${e.id}" style="transition: all 0.6s ease; transition-delay: ${Math.min(i * 0.1, 1.5)}s">
              <img src="${resolveImgSrc(e.images && e.images[0], e.imageUrl)}" 
                   class="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-0" 
                   loading="lazy"
                   onload="this.classList.add('loaded'); this.parentElement.classList.add('loaded');"
                   onerror="this.src='${BROKEN_ASSET}'; this.classList.add('loaded'); this.parentElement.classList.add('loaded'); this.classList.add('broken-asset');" />
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                <p class="text-[9px] text-white font-bold uppercase tracking-wider truncate">${e.tags.brand}</p>
                <p class="text-[7px] text-white/60 uppercase truncate">${e.title}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Attach Listeners
  container.querySelectorAll('.timeline-item').forEach(el => {
    el.addEventListener('click', () => {
      if (callbacks && callbacks.openDetail) {
        callbacks.openDetail(el.dataset.id);
      }
    });
  });
}

export function renderFilterChips(callbacks) {
  const container = $('filter-chips');
  if (!container) return;
  
  let chips = [];
  if (AppState.searchQuery) {
    chips.push({ label: `${getTranslation('search_prefix', AppState.language)}: ${AppState.searchQuery}`, type: 'search', value: '' });
  }

  Object.entries(AppState.filters).forEach(([type, val]) => {
    if (val) {
      const translatedType = getTranslation(`tax_${type}`, AppState.language);
      const translatedVal = getTranslation(val, AppState.language);
      chips.push({ label: `${translatedType.toUpperCase()}: ${translatedVal}`, type, value: val });
    }
  });

  if (chips.length === 0) {
    container.innerHTML = `<span class="text-[8px] opacity-20 uppercase tracking-widest">${getTranslation('no_active_filters', AppState.language)}</span>`;
    return;
  }

  container.innerHTML = chips.map(c => `
    <button class="filter-chip bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-80 transition-opacity" 
            data-type="${c.type}" data-value="${c.value}">
      ${c.label}
      <span class="opacity-50">✕</span>
    </button>
  `).join('');

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'search') {
        AppState.searchQuery = '';
        if ($('search-input')) $('search-input').value = '';
      } else {
        AppState.filters[type] = null;
      }
      if (callbacks && callbacks.switchView) callbacks.switchView('grid');
      // refreshUI called by app.js via delegation usually, but here we just update state
      // Actually app.js needs to know. For now we assume refreshUI is handled.
      const event = new CustomEvent('lexicon-refresh');
      document.dispatchEvent(event);
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
  if (ogImg) ogImg.content = resolveImgSrc(entry.images && entry.images[0], entry.imageUrl);

  // Twitter Tags
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.content = title;

  const twImg = document.querySelector('meta[name="twitter:image"]');
  if (twImg) twImg.content = resolveImgSrc(entry.images && entry.images[0], entry.imageUrl);
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
