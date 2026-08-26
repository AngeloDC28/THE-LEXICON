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
      ? `<div class="t-mono-xs font-mono text-black/50 dark:text-white/50 mb-4 max-w-md mx-auto">
           <div class="text-[8px] uppercase tracking-[0.2em] opacity-60 mb-2">${getTranslation('filtering_label', lang)}</div>
           <div class="flex flex-wrap justify-center gap-1">
             ${activeFilters.map(([k, v]) => `<span class="border border-current px-2 py-0.5 t-mono-xs uppercase">${getTranslation('tax_' + k, lang)}: ${getTranslation(v, lang)}</span>`).join('')}
             ${AppState.searchQuery ? `<span class="border border-current px-2 py-0.5 t-mono-xs uppercase">"${AppState.searchQuery}"</span>` : ''}
           </div>
         </div>`
      : '';
    grid.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-24 text-center px-4">
        <div class="text-xs font-mono uppercase tracking-widest text-black/40 dark:text-white/40 mb-3">${getTranslation('null_set', lang)}</div>
        <div class="t-mono-xs font-mono text-black/30 dark:text-white/30 mb-4">${getTranslation('null_set_desc', lang)}</div>
        ${filtersList}
        <button type="button" id="btn-reset-filters-null" class="border border-black dark:border-white t-mono-xs font-mono uppercase tracking-widest px-4 py-2 min-h-[44px] hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-colors focus-ring">${getTranslation('btn_reset_system', lang)}</button>
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
      const catTip   = getTranslation(`cat_tip_${tagCategory}`, AppState.language);

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

      // Only the first image per entry is a keyboard/screen-reader target.
      // Subsequent images are presentational — clickable via mouse but not
      // tab-reachable. This reduces tab stops from 643 → 45.
      const isFirst = i === 0;
      const a11yAttrs = isFirst
        ? `tabindex="0" role="button" aria-label="Open ${brand} ${season} ${year} — ${tagLabel} (${imgs.length} image${imgs.length !== 1 ? 's' : ''})"`
        : `aria-hidden="true"`;

      html += `
        <div class="grid-cell grid-cell--delay-${index % 10}"
             data-entry-id="${entry.id}"
             data-img-index="${i}"
             ${a11yAttrs}>
          <div class="grid-cell-tag-strip" data-cat="${tagCategory}">
            <span class="gc-tag-label"${catTip ? ` data-tooltip="${catTip.replace(/"/g, '&quot;')}"` : ''}>${tagLabel}</span>
          </div>
          <div class="grid-cell-img group">
            ${hotspotBadge}
            <picture>
              <source type="image/webp" srcset="${resolveImgSrc({src: webpSrc(imgObj)})}">
              <img
                src="${src}"${imgAttrs(imgObj)}
                alt="${isFirst ? brand + ' ' + season + ' ' + year : ''}"
                loading="lazy"
                decoding="async"
                class="transition-transform duration-500 group-hover:scale-105">
            </picture>
          </div>
          <div class="grid-cell-body">
            <div class="gc-meta">${metaLine}</div>
            ${hook ? `<div class="gc-hook">${hook}.</div>` : ''}
            ${isFirst && entry.vibes?.length ? `<div class="gc-vibes">${entry.vibes.slice(0,3).map(v => `<button type="button" class="gc-vibe" data-vibe="${v}" aria-label="Find entries with the vibe: ${v}">${v}</button>`).join('')}</div>` : ''}
          </div>
        </div>`;
    });
  });

  grid.innerHTML = html;
  grid.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', () => img.classList.add('loaded'));
    img.addEventListener('error', () => {
      img.src = BROKEN_ASSET;
      img.classList.add('loaded');
    }, { once: true });
  });
  // After a short wait, mark any viewport images already in the browser
  // cache as loaded so they don't sit at opacity:0 on re-visits.
  // The timeout gives the browser time to fire intersection observer →
  // start loading → resolve from cache before we check img.complete.
  setTimeout(() => {
    grid.querySelectorAll('img').forEach(img => { if (img.complete) img.classList.add('loaded'); });
  }, 150);
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
    totalLabel.textContent = count < total
      ? `${t('index_title')} · ${pad(count)} of ${pad(total)}`
      : `${t('index_title')} · ${pad(total)}`;
  }

  if (count === 0) {
    const t = (key) => getTranslation(key, AppState.language);
    const hasActiveFilters = Object.values(AppState.filters || {}).some(Boolean) ||
                             AppState.searchQuery ||
                             (AppState.yearRange && (AppState.yearRange.min > 1980 || AppState.yearRange.max < 2025));
    let emptyMsg;
    if (AppState.bookmarksOnly) {
      emptyMsg = t('no_results_bookmarks') || 'No saved entries yet. Use ★ on any entry to bookmark it.';
    } else if (AppState.searchQuery) {
      emptyMsg = (t('no_results_search') || 'No entries match “{q}”. Try a brand, year, or analytical category — or clear filters to browse all {n}.')
        .replace('{q}', AppState.searchQuery)
        .replace('{n}', total);
    } else {
      emptyMsg = t('no_results');
    }
    container.innerHTML = `
      <div role="status" aria-live="polite" class="p-6 border border-black/10 dark:border-white/10 m-4">
        <p class="t-mono-xs font-mono uppercase tracking-[0.2em] text-acid mb-2">FILTER NULL</p>
        <p class="t-mono-sm font-mono text-black/70 dark:text-white/70 mb-3">${emptyMsg}</p>
        ${hasActiveFilters ? `<button type="button" id="btn-clear-all-filters" class="t-mono-xs font-mono font-bold uppercase tracking-[0.2em] border border-current px-3 py-1.5 hover:bg-acid hover:text-black hover:border-acid transition-colors focus-ring">${t('clear_all_filters') || 'CLEAR FILTERS'}</button>` : ''}
      </div>`;
    return;
  }

  const lang = AppState.language;
  const tagLabels = {
    corporeal: 'CORPOREAL', critique: 'CRITIQUE', subculture: 'SUBCULTURE',
    strategy: 'STRATEGY', semiotic: 'SEMIOTIC', provenance: 'PROVENANCE'
  };
  let prevCat = null;
  container.innerHTML = filtered.map(entry => {
    const brand = (entry.tags && entry.tags.brand)
      ? getTranslation(entry.tags.brand, lang)
      : getTranslation('brand_unknown', lang);
    const year  = entry.year  || '----';
    const season = entry.season ? entry.season.replace(/^(SS|AW|FW|SS\/FW)\s*/i, '') : '';
    const tagCategory = getTagCategory(entry.tags?.politics || '');
    const tagLabel = tagLabels[tagCategory] || 'ARCHIVE';
    const isNewCat = tagCategory !== prevCat;
    prevCat = tagCategory;
    const isActiveCat = AppState.analyticalCat === tagCategory;
    const listCatTip  = getTranslation(`cat_tip_${tagCategory}`, lang);
    const catHeader = isNewCat
      ? `<button type="button" class="entry-cat-header focus-ring${isActiveCat ? ' entry-cat-header--active' : ''}" data-cat-filter="${tagCategory}" aria-pressed="${isActiveCat}" aria-label="Filter by ${tagLabel}" aria-description="${listCatTip}">${tagLabel}${isActiveCat ? ' ×' : ''}</button>`
      : '';
    // Thumbnail — first image of entry, shown inline on desktop
    const firstImg = Array.isArray(entry.images) ? entry.images[0] : null;
    const thumbSrc = firstImg?.src ? resolveImgSrc({ src: firstImg.src }) : null;
    const thumbWebp = firstImg ? resolveImgSrc({ src: webpSrc(firstImg) }) : null;
    const thumb = thumbSrc
      ? `<picture class="entry-item-thumb" aria-hidden="true">
           <source type="image/webp" srcset="${thumbWebp}">
           <img src="${thumbSrc}" alt="" loading="lazy" decoding="async">
         </picture>`
      : '';
    return `${catHeader}<div class="entry-item cursor-crosshair border-b border-black/5 dark:border-white/5 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-ring"
           data-id="${entry.id}"
           data-thumb="${thumbSrc || ''}"
           role="button"
           tabindex="0"
           aria-label="${brand} ${year} ${tagLabel}">
        <div class="entry-item-inner">
          <div>
            <div class="entry-item-brand">${brand}</div>
            <div class="entry-item-meta">${year}${season ? ' · ' + season : ''}</div>
          </div>
          ${thumb}
        </div>
      </div>`;
  }).join('');
  container.querySelectorAll('.entry-item-thumb img').forEach(img => {
    img.addEventListener('error', () => {
      img.parentElement.style.display = 'none';
    }, { once: true });
  });
}

// Phase 1: Featured strip — one card per analytical category, ordered by year desc.
export function renderFeaturedStrip(archiveData) {
  const container = $('featured-strip');
  if (!container) return;

  // Featured strip is a landing-page section — don't show once orientation is dismissed
  const panel = $('orientation-panel');
  if (!panel || panel.classList.contains('hidden')) return;

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

  // Pick 4 random entries on each load, labelled by their analytical category
  const shuffled = [...archiveData].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 4).map(entry => {
    const cat = getTagCategory(entry.tags?.politics || '') || 'critique';
    return { cat, entry };
  });

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
           <img src="${imgSrc}" alt="" loading="lazy" decoding="async">
         </picture>`
      : '';

    return `
      <div class="feat-card tag-${cat}" data-entry-id="${entry.id}" role="button" tabindex="0"
           aria-label="${label} — ${brand} ${year}">
        <div class="feat-card-tag">
          <span class="fc-label">${label.toUpperCase()}</span>
        </div>
        <div class="feat-card-img">${imgHtml}</div>
        <div class="feat-card-body">
          <div class="feat-card-meta">${brand} · ${year} · ${season}</div>
          ${hook ? `<div class="feat-card-hook">${hook}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.feat-card-img img').forEach(img => {
    img.addEventListener('error', () => {
      img.src = BROKEN_ASSET;
    }, { once: true });
  });

  // Click to open detail
  container.querySelectorAll('.feat-card').forEach(card => {
    const open = () => {
      const id = card.dataset.entryId;
      if (id) document.dispatchEvent(new CustomEvent('lexicon:navigate', { detail: { id, idx: 0 } }));
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}
