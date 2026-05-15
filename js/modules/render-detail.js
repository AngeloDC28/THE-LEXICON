/**
 * render-detail.js
 * Logic for detail view, hotspots, and metadata.
 *
 * FIX 1: Images — set onload/onerror BEFORE setting src, so cached images
 * don't silently miss the load event.
 * FIX 2: Hotspot buttons no longer have a redundant inline addEventListener;
 * delegation is handled entirely by hotspots.js initHotspotInteractions().
 * FIX 3: Related-entry images use resolveImgSrc so paths resolve correctly.
 */
import { $, pad, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState, stickyNotes, updateHash } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';
import { getTranslation } from './translations.js';
import { toggleHotspot } from './hotspots.js';

export function updateStatusBar(archiveData) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  const brand       = $('status-brand');
  const year        = $('status-year');
  const season      = $('status-season');
  const entryStatus = $('status-entry');
  if (entry) {
    if (brand)       brand.textContent       = entry.tags.brand;
    if (year)        year.textContent        = entry.year;
    if (season)      season.textContent      = entry.season;
    if (entryStatus) entryStatus.textContent = pad(archiveData.indexOf(entry) + 1) + ' / ' + pad(archiveData.length);
  } else {
    const filtered = getFilteredEntries(archiveData);
    if (brand)       brand.textContent       = '--';
    if (year)        year.textContent        = '--';
    if (season)      season.textContent      = '--';
    if (entryStatus) entryStatus.textContent = pad(filtered.length) + ' ENTRIES';
  }
}

export function openDetail(entryId, imgIdx, archiveData, callbacks) {
  console.log('LEXICON_ACTION: OPEN_DETAIL_INIT', { entryId, imgIdx });
  const entry = archiveData.find((e) => e.id === entryId);
  if (!entry) return;

  AppState.selectedEntryId   = entryId;
  const imgs = entry.images || [{ src: entry.imageUrl }];
  AppState.currentImageIndex = (typeof imgIdx === 'number') ? Math.min(imgIdx, imgs.length - 1) : 0;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  const detailView = $('detail-image-view');
  if (detailView) detailView.classList.remove('hidden');
  const appRoot = $('app-root');
  if (appRoot) appRoot.classList.add('detail-mode-active');

  renderImage(entry, callbacks);
  renderMetadata(entry);
  renderHotspots(entry, $('detail-image-wrapper'));
  renderRelatedEntries(entry, archiveData, callbacks);

  if (callbacks) {
    if (callbacks.updateHeaderTelemetry) callbacks.updateHeaderTelemetry(`ACCESSING_NODE: ${entry.id.toUpperCase()}`);
    if (callbacks.addRecentlyViewed)     callbacks.addRecentlyViewed(entryId);
    if (callbacks.updateBookmarkUI)      callbacks.updateBookmarkUI(entryId);
    if (callbacks.updateMetaForEntry)    callbacks.updateMetaForEntry(entry);
  }

  updateHash(`detail/${entryId}/${AppState.currentImageIndex}`);
  updateStatusBar(archiveData);
}

export function closeDetail(callbacks, archiveData) {
  AppState.selectedEntryId = null;
  updateHash(null);
  const detailView = $('detail-image-view');
  if (detailView) detailView.classList.add('hidden');
  const appRoot = $('app-root');
  if (appRoot) appRoot.classList.remove('detail-mode-active');
  if (callbacks && callbacks.resetMeta) callbacks.resetMeta();
  const glow = $('accent-glow');
  if (glow) glow.style.boxShadow = '';
  updateStatusBar(archiveData);
}

export function navigateEntry(direction, archiveData, callbacks) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const imgs = entry.images || [{ src: entry.imageUrl }];
  const nextImg = AppState.currentImageIndex + direction;
  if (nextImg >= 0 && nextImg < imgs.length) {
    openDetail(entry.id, nextImg, archiveData, callbacks);
    return;
  }
  const entries = getFilteredEntries(archiveData);
  if (entries.length <= 1) return;
  let currentIndex = entries.findIndex(e => e.id === AppState.selectedEntryId);
  if (currentIndex === -1) return;
  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = entries.length - 1;
  if (newIndex >= entries.length) newIndex = 0;
  const nextEntry = entries[newIndex];
  const startImg = direction > 0 ? 0 : (nextEntry.images || [1]).length - 1;
  openDetail(nextEntry.id, startImg, archiveData, callbacks);
}

/**
 * renderImage
 * FIX: Sets onerror and onload handlers BEFORE assigning src.
 * This ensures the load event is caught even for cached images.
 * extractAccentColor is called inside onload so the image is guaranteed painted.
 */
function renderImage(entry, callbacks) {
  const imgs = entry.images || [{ src: entry.imageUrl }];
  const currentImgObj = imgs[AppState.currentImageIndex];
  const currentImgSrc = resolveImgSrc(currentImgObj, entry.imageUrl);

  const imgEl = $('detail-image');
  if (imgEl) {
    // Clear old src first to force reload event on same-URL navigation
    imgEl.src = '';
    imgEl.classList.remove('broken-asset');

    imgEl.onerror = () => {
      imgEl.src = BROKEN_ASSET;
      imgEl.classList.add('broken-asset');
    };

    imgEl.onload = () => {
      if (callbacks && callbacks.extractAccentColor) {
        callbacks.extractAccentColor(imgEl);
      }
    };

    // Set src AFTER handlers are attached
    imgEl.src = currentImgSrc;
    imgEl.alt = entry.title || entry.id;

    // Scan animation
    const scanLine = $('scan-line');
    if (scanLine) {
      scanLine.classList.add('active');
      if (window._scanTimeout) clearTimeout(window._scanTimeout);
      window._scanTimeout = setTimeout(() => scanLine.classList.remove('active'), 2500);
    }
  }

  const titleEl = $('active-entry-title');
  if (titleEl) {
    const brand = getTranslation(entry.tags.brand, AppState.language);
    titleEl.textContent = `${brand} ${entry.year} [${pad(AppState.currentImageIndex + 1)}/${pad(imgs.length)}]`;
  }
}

function renderMetadata(entry) {
  const grid = $('metadata-grid');
  if (!grid) return;
  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);
  const fields = [
    { label: t('tax_era'),        value: entry.tags.era },
    { label: t('tax_gender'),     value: entry.tags.gender },
    { label: t('tax_politics'),   value: entry.tags.politics },
    { label: t('tax_theories'),   value: entry.tags.theories },
    { label: t('tax_materials'),  value: entry.tags.materials },
    { label: t('tax_geography'),  value: entry.tags.geography }
  ];
  grid.innerHTML = fields.map(f =>
    `<div class="space-y-1">
      <div class="text-[9px] font-mono uppercase tracking-widest text-black/40 dark:text-white/40">${f.label}</div>
      <div class="text-[10px] font-mono uppercase tracking-wide">${getTranslation(f.value, AppState.language) || '--'}</div>
    </div>`
  ).join('');
}

/**
 * renderHotspots
 * FIX: Buttons no longer attach their own click listeners.
 * Click handling is delegated via the container listener in hotspots.js.
 * This prevents the "double-fire" bug where each click triggered two handlers.
 */
function renderHotspots(entry, container) {
  if (!container) return;
  container.querySelectorAll('.hotspot-btn').forEach(el => el.remove());

  const imgs = entry.images || [{ src: entry.imageUrl }];
  const currentImgObj = imgs[AppState.currentImageIndex];
  const hotspots = currentImgObj?.hotspots || entry.hotspots || [];

  const hotspotsContainer = $('active-entry-hotspots');
  if (hotspotsContainer) hotspotsContainer.innerHTML = '';

  hotspots.forEach((spot, i) => {
    // Floating button — NO addEventListener; delegation in hotspots.js handles it
    const btn = document.createElement('button');
    btn.className = 'hotspot-btn focus-ring';
    btn.style.left = spot.x + '%';
    btn.style.top  = spot.y + '%';
    btn.setAttribute('data-index', i);
    btn.setAttribute('aria-label', `Intervention: ${spot.label}`);
    btn.innerHTML = '<span></span>';
    container.appendChild(btn);

    // Sidebar info box
    if (hotspotsContainer) {
      const box = document.createElement('div');
      box.className = 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-3 transition-all duration-300';
      box.setAttribute('data-hotspot-index', i);
      box.innerHTML = `
        <div class="text-[10px] font-mono uppercase tracking-widest mb-1">${spot.label}</div>
        <div class="text-[10px] font-mono leading-relaxed text-black/60 dark:text-white/60">${spot.description}</div>
      `;
      hotspotsContainer.appendChild(box);
    }
  });
}

function renderRelatedEntries(entry, archiveData, callbacks) {
  const container = $('related-grid');
  if (!container) return;
  const currentTags = Object.values(entry.tags).flat();
  const scored = archiveData
    .filter(e => e && e.id && e.id !== entry.id)
    .map(e => {
      let score = 0;
      if (e.tags) {
        const targetTags = Object.values(e.tags).flat();
        targetTags.forEach(t => { if (currentTags.includes(t)) score++; });
      }
      return { entry: e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  container.innerHTML = '';
  scored.forEach(item => {
    const src = resolveImgSrc(
      item.entry.images?.[0] || { src: item.entry.imageUrl },
      item.entry.imageUrl
    );
    const card = document.createElement('div');
    card.className = 'group cursor-crosshair';
    card.innerHTML = `
      <img src="${src}" alt="${item.entry.tags.brand}" loading="lazy"
           class="w-full aspect-[3/4] object-cover grayscale group-hover:grayscale-0 transition-all"
           onerror="this.src='${BROKEN_ASSET}'">
      <div class="text-[9px] font-mono uppercase mt-1 tracking-widest">${item.entry.tags.brand}</div>
    `;
    card.addEventListener('click', () => openDetail(item.entry.id, 0, archiveData, callbacks));
    container.appendChild(card);
  });
}
