/**
 * ui-extras.js
 * Timeline matrix, filter chips, and metadata.
 */

import { $, pad, resolveImgSrc } from './core-utils.js';
import { AppState } from './core-state.js';

export function renderTimeline(archiveData, callbacks) {
  const container = $('timeline-matrix');
  if (!container) return;

  const years = {};
  archiveData.forEach(e => {
    if (!years[e.year]) years[e.year] = [];
    years[e.year].push(e);
  });

  const sortedYears = Object.keys(years).sort((a, b) => b - a);
  
  container.innerHTML = sortedYears.map(year => {
    const entries = years[year];
    return `
      <div class="border-t border-black/10 dark:border-white/10 pt-8">
        <div class="flex items-baseline gap-4 mb-6">
          <h3 class="text-2xl font-bold font-mono tracking-tighter">${year}</h3>
          <span class="text-[8px] uppercase tracking-widest opacity-40">${entries.length} Artifacts</span>
        </div>
        <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          ${entries.map(e => `
            <div class="aspect-[3/4] overflow-hidden border border-black/5 dark:border-white/5 cursor-crosshair group" onclick="window.openDetail('${e.id}')">
              <img src="${resolveImgSrc(e.images && e.images[0], e.imageUrl)}" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" loading="lazy" />
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Note: window.openDetail is a shortcut for the click delegation if needed, 
  // but we prefer standard app.js delegation. We'll use IDs.
  container.querySelectorAll('[onclick]').forEach(el => {
    const attr = el.getAttribute('onclick');
    const match = attr.match(/'([^']+)'/);
    if (match) {
      el.removeAttribute('onclick');
      el.addEventListener('click', () => callbacks.openDetail(match[1]));
    }
  });
}

export function renderFilterChips(callbacks) {
  const container = $('filter-chips');
  if (!container) return;
  
  let chips = [];
  if (AppState.searchQuery) {
    chips.push({ label: `SEARCH: ${AppState.searchQuery}`, type: 'search', value: '' });
  }

  Object.entries(AppState.filters).forEach(([type, val]) => {
    if (val) {
      chips.push({ label: `${type.toUpperCase()}: ${val}`, type, value: val });
    }
  });

  if (chips.length === 0) {
    container.innerHTML = '<span class="text-[8px] opacity-20 uppercase tracking-widest">No active filters</span>';
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
