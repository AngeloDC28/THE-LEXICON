/**
 * render-grid.js
 * Rendering logic for the image grid.
 * FIX: Grid image src now uses resolveImgSrc() which anchors paths to
 * window.location.origin, fixing the broken image issue where relative paths
 * resolved incorrectly depending on the current URL.
 */
import { $, pad, resolveImgSrc, imgAttrs, webpSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState, gridIntersectionObserver, setGridIntersectionObserver, emptyFilters } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';
import { getTranslation } from './translations.js';
import { getTagCategory } from './render-index-view.js';

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
    if (folName) folName.textContent = fol ? fol.name : getTranslation('folder_unknown', AppState.language);
  } else {
    if (folIndicator) folIndicator.classList.add('hidden');
  }

  if (entries.length === 0) {
    const lang = AppState.language;
    const activeFilters = Object.entries(AppState.filters).filter(([_, v]) => v);
    const filtersList = activeFilters.length
      ? `<div class="text-[10px] font-mono text-black/50 dark:text-white/50 mb-4 max-w-md mx-auto">
           <div class="text-[8px] uppercase tracking-[0.2em] opacity-60 mb-2">${getTranslation('filtering_label', lang)}</div>
           <div class="flex flex-wrap justify-center gap-1">
             ${activeFilters.map(([k, v]) => `<span class="border border-current px-2 py-0.5 text-[9px] uppercase">${getTranslation('tax_' + k, lang)}: ${getTranslation(v, lang)}</span>`).join('')}
             ${AppState.searchQuery ? `<span class="border border-current px-2 py-0.5 text-[9px] uppercase">"${AppState.searchQuery}"</span>` : ''}
           </div>
         </div>`
      : '';
    grid.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-24 text-center px-4">
        <div class="text-xs font-mono uppercase tracking-widest text-black/40 dark:text-white/40 mb-3">${getTranslation('null_set', lang)}</div>
        <div class="text-[10px] font-mono text-black/30 dark:text-white/30 mb-4">${getTranslation('null_set_desc', lang)}</div>
        ${filtersList}
        <button id="btn-reset-filters-null" class="border border-black dark:border-white text-[10px] font-mono uppercase tracking-widest px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-colors">${getTranslation('btn_reset_system', lang)}</button>
      </div>`;
    $('btn-reset-filters-null')?.addEventListener('click', () => {
      AppState.filters = emptyFilters();
      AppState.searchQuery = '';
      if ($('search-input')) $('search-input').value = '';
      if (callbacks && callbacks.onUpdate) callbacks.onUpdate();
    });
    return;
  }

  let html = '';
  entries.forEach((entry, index) => {
    const imgs = entry.images;
    imgs.forEach((imgObj, i) => {
      // FIX: use resolveImgSrc so all paths become absolute URLs
      const src   = resolveImgSrc(imgObj);
      const delay = (index % 10) * 0.05;
      const brand = (entry.tags && entry.tags.brand)
        ? getTranslation(entry.tags.brand, AppState.language)
        : getTranslation('brand_unknown', AppState.language);

      // Phase 1: Inverted metadata hierarchy — extract primary analytical tag
      const politicsTag = entry.tags?.politics || '';
      const tagCategory = getTagCategory(politicsTag);
      const tagLabels = {
        corporeal: 'CORPOREAL', critique: 'CRITIQUE', subculture: 'SUBCULTURE',
        strategy: 'STRATEGY', semiotic: 'SEMIOTIC', provenance: 'PROVENANCE'
      };
      const tagLabel = tagLabels[tagCategory] || 'ARCHIVE';
      const tagColor = `--c-${tagCategory}`;

      const hotspotCount = (imgObj?.hotspots || []).length;
      const hotspotBadge = hotspotCount > 0
        ? `<div class="grid-cell-hotspot-badge" aria-label="${hotspotCount} hotspot${hotspotCount > 1 ? 's' : ''}">◉ ${hotspotCount}</div>`
        : '';
      const season = entry.season || '';
      const year = entry.year || '----';
      const metaLine = [brand.toUpperCase(), year, season].filter(Boolean).join(' · ');
      // Only show hook on first image of each entry (i===0) to avoid repetition
      const hookRaw = i === 0 ? (entry.notes?.critique || '') : '';
      const hook = hookRaw ? hookRaw.split('.')[0].trim().slice(0, 80) : '';
      html += `
        <div class="grid-cell"
             data-entry-id="${entry.id}"
             data-img-index="${i}"
             tabindex="0"
             role="button"
             aria-label="${brand} ${year} ${tagLabel}"
             style="animation-delay: ${delay}s">
          <!-- Tag strip: above image (Phase 1: inverted metadata hierarchy) -->
          <div class="grid-cell-tag-strip">
            <span class="gc-tag-label" style="color: var(${tagColor}, #999)">${tagLabel}</span>
            <span class="gc-tag-id" aria-hidden="true">N-${entry.id.slice(0,6).toUpperCase()}</span>
          </div>
          <!-- Image wrapper -->
          <div class="grid-cell-img group">
            ${hotspotBadge}
            <picture>
              <source type="image/webp" srcset="${resolveImgSrc({src: webpSrc(imgObj)})}">
              <img
                src="${src}"${imgAttrs(imgObj)}
                alt="${brand} ${season} ${year}"
                loading="lazy"
                decoding="async"
                class="transition-transform duration-500 group-hover:scale-105"
                onload="this.classList.add('loaded')" onerror="this.onerror=null;this.src='${BROKEN_ASSET}';this.classList.add('loaded')">
            </picture>
          </div>
          <!-- Always-visible metadata below image -->
          <div class="grid-cell-body">
            <div class="gc-meta">${metaLine}</div>
            ${hook ? `<div class="gc-hook">${hook}.</div>` : ''}
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
  // Mobile: skip the heavy entry-list rebuild while the drawer is
  // hidden (every search keystroke was re-rendering a list nobody could
  // see). Re-renders fire normally once the drawer opens via
  // toggleHamburger → callbacks.onUpdate.
  const panel = $('index-panel');
  if (window.innerWidth < 1024 && panel && panel.classList.contains('-translate-x-full')) {
    return;
  }
  const filtered = getFilteredEntries(archiveData);
  const total    = archiveData.length;
  const count    = filtered.length;

  const totalLabel = $('index-panel-title');
  if (totalLabel) {
    const t = (key) => getTranslation(key, AppState.language);
    totalLabel.textContent = `${t('index_title')} / ${pad(count)} OF ${pad(total)}`;
  }

  if (count === 0) {
    container.innerHTML = `<p class="text-[10px] font-mono text-black/40 dark:text-white/40 p-4">${getTranslation('no_results', AppState.language)}</p>`;
    return;
  }

  const lang = AppState.language;
  const tagLabels = {
    corporeal: 'CORPOREAL', critique: 'CRITIQUE', subculture: 'SUBCULTURE',
    strategy: 'STRATEGY', semiotic: 'SEMIOTIC', provenance: 'PROVENANCE'
  };
  container.innerHTML = filtered.map(entry => {
    const brand = (entry.tags && entry.tags.brand)
      ? getTranslation(entry.tags.brand, lang)
      : getTranslation('brand_unknown', lang);
    const year  = entry.year  || '----';
    const title = entry.title ? getTranslation(entry.title, lang) : getTranslation('entry_untitled', lang);
    // Phase 1: Inverted metadata — analytical tag is primary, brand is secondary
    const tagCategory = getTagCategory(entry.tags?.politics || '');
    const tagLabel = tagLabels[tagCategory] || 'ARCHIVE';
    return `
      <div class="entry-item cursor-crosshair border-b border-black/5 dark:border-white/5 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
           data-id="${entry.id}">
        <div class="text-[9px] font-mono uppercase tracking-[0.18em] font-bold" style="color: var(--c-${tagCategory}, currentColor)">${tagLabel}</div>
        <div class="text-[10px] font-mono uppercase tracking-widest font-medium mt-0.5">${brand}</div>
        <div class="text-[9px] font-mono text-black/40 dark:text-white/40 mt-0.5">
          <span>${year}</span>
        </div>
        <div class="text-[9px] font-mono text-black/60 dark:text-white/60 mt-0.5 truncate">${title}</div>
      </div>`;
  }).join('');
}

// Phase 1: Featured strip — one card per analytical category, ordered by year desc.
export function renderFeaturedStrip(archiveData) {
  const container = $('featured-strip');
  if (!container) return;

  const lang = AppState.language;
  const CATEGORIES = ['critique', 'subculture', 'corporeal', 'semiotic'];
  const tagLabelMap = {
    corporeal: 'Corporeal Intervention',
    critique: 'Institutional Critique',
    subculture: 'Subcultural Codification',
    semiotic: 'Semiotic Sabotage',
    strategy: 'Strategic Appropriation',
    provenance: 'Historical Lineage',
  };

  // Pick best (most recent) entry per category
  const picks = CATEGORIES.map(cat => {
    const match = [...archiveData]
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .find(e => getTagCategory(e.tags?.politics || '') === cat);
    return match ? { cat, entry: match } : null;
  }).filter(Boolean);

  if (picks.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = picks.map(({ cat, entry }) => {
    const brand = entry.tags?.brand
      ? getTranslation(entry.tags.brand, lang).toUpperCase()
      : '—';
    const year = entry.year || '----';
    const season = entry.season ? entry.season.toUpperCase() : 'ARCHIVE';
    const id = `N-${entry.id.slice(0, 4).toUpperCase()}`;
    const label = tagLabelMap[cat] || cat.toUpperCase();
    const firstImg = Array.isArray(entry.images) ? entry.images[0] : null;
    const imgSrc = firstImg?.src ? resolveImgSrc({ src: firstImg.src }) : null;
    const webpImg = firstImg ? resolveImgSrc({ src: webpSrc(firstImg) }) : null;
    const hook = entry.notes?.critique
      ? getTranslation(entry.notes.critique, lang).replace(/<[^>]+>/g, '').slice(0, 120) + '…'
      : (entry.notes?.provenance
          ? getTranslation(entry.notes.provenance, lang).replace(/<[^>]+>/g, '').slice(0, 120) + '…'
          : '');

    const imgHtml = imgSrc
      ? `<picture>
           <source type="image/webp" srcset="${webpImg}">
           <img src="${imgSrc}" alt="${brand}" loading="lazy" decoding="async"
                onerror="this.onerror=null;this.src='${BROKEN_ASSET}'">
         </picture>`
      : '';

    return `
      <div class="feat-card tag-${cat}" data-entry-id="${entry.id}" role="button" tabindex="0"
           aria-label="${label} — ${brand} ${year}" title="Open ${brand} ${year}">
        <div class="feat-card-tag">
          <span class="fc-label">${label.toUpperCase()}</span>
          <span class="fc-id">${id}</span>
        </div>
        <div class="feat-card-img">${imgHtml}</div>
        <div class="feat-card-body">
          <div class="feat-card-meta">${brand} · ${year} · ${season}</div>
          ${hook ? `<div class="feat-card-hook">${hook}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Click to open detail
  container.querySelectorAll('.feat-card').forEach(card => {
    const open = () => {
      const id = card.dataset.entryId;
      if (id) window.location.hash = `detail/${id}/0`;
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}
