/**
 * render-detail.js
 * Logic for detail view, hotspots, and metadata.
 *
 * FIX 1: Images — set onload/onerror BEFORE setting src, so cached images
 * don't silently miss the load event.
 * FIX 2: Hotspot buttons no longer have a redundant inline addEventListener;
 * delegation is handled entirely by hotspots.js initHotspotInteractions().
 * FIX 3: Related-entry images use resolveImgSrc so paths resolve correctly.
 * ENH: fullscreen toggling (button + double-click), metadata overlay injected
 *      into the detail-image-wrapper (anchored bottom-left) and hidden by default
 *      when in fullscreen. CSS required for these behaviors is injected dynamically
 *      so the change doesn't require editing index.css or index.html.
 */
import { $, pad, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState, stickyNotes, updateHash } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';
import { getTranslation } from './translations.js';
import { toggleHotspot } from './hotspots.js';

// Inject small CSS fixes and UI helpers (removes forced grayscale and styles
// fullscreen + metadata overlay). This is injected once when detail is opened.
function injectDetailFixesCSS() {
  if (document.getElementById('lexicon-fixes')) return;
  const css = `
    /* Remove enforced grayscale so images display in full colour */
    .grid-cell img, .entry-thumbnail img, #detail-image, .recent-thumb, .node-thumb {
      filter: none !important;
    }

    /* Fullscreen toggle button (small, unobtrusive) */
    #btn-fullscreen-toggle {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 1200;
      background: rgba(0,0,0,0.6);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.06);
      padding: 6px 8px;
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
      backdrop-filter: blur(4px);
    }
    #btn-fullscreen-toggle:focus { outline: 2px solid #CCFF00; outline-offset: 2px; }

    /* Metadata overlay anchored bottom-left of the image wrapper */
    #detail-metadata-overlay {
      position: absolute;
      left: 12px;
      bottom: 12px;
      z-index: 1100;
      max-width: 46%;
      background: var(--bg-overlay);
      color: var(--text-main);
      padding: 10px 12px;
      font-family: var(--font-mono);
      font-size: 12px;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 2px 2px 0 rgba(0,0,0,0.06);
      pointer-events: none; /* Important: don't block clicks/hotspots */
      display: block;
    }

    /* Small metadata toggle shown in top-left so users can reveal metadata in fullscreen */
    #btn-metadata-toggle {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 1200;
      background: rgba(0,0,0,0.6);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.06);
      padding: 6px 8px;
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
    }

    /* Fullscreen state: hide the anchored overlay by default to prioritise the image */
    #detail-image-view.fullscreen-active #detail-metadata-overlay {
      display: none;
    }
    /* But allow toggling it on in fullscreen (class added when user toggles metadata) */
    #detail-image-view.fullscreen-active.show-metadata #detail-metadata-overlay {
      display: block;
      pointer-events: auto; /* When explicitly shown, allow interaction if needed */
    }

    /* Minor styling for the inner metadata rows to match existing UI */
    #detail-metadata-overlay .meta-row { margin-bottom: 6px; }
    #detail-metadata-overlay .meta-label { font-size: 10px; text-transform: uppercase; opacity: 0.6; letter-spacing: .12em; }
    #detail-metadata-overlay .meta-value { font-size: 12px; text-transform: uppercase; }
  `;
  const el = document.createElement('style');
  el.id = 'lexicon-fixes';
  el.appendChild(document.createTextNode(css));
  document.head.appendChild(el);
}

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

  // Inject CSS fixes once per page load
  if (typeof document !== 'undefined') injectDetailFixesCSS();

  renderImage(entry, callbacks);
  renderMetadata(entry);
  renderHotspots(entry, $('detail-image-wrapper'));
  renderRelatedEntries(entry, archiveData, callbacks);

  // Setup fullscreen & metadata toggle UI (idempotent)
  setupDetailControls();

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
  if (detailView) {
    detailView.classList.add('hidden');
    // Ensure fullscreen classes cleared
    detailView.classList.remove('fullscreen-active', 'show-metadata');
  }
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

    // Double-click opens fullscreen as a convenient shortcut
    imgEl.ondblclick = () => toggleFullscreen();

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

  // Also render a compact metadata overlay anchored on the image wrapper
  try {
    let wrapper = $('detail-image-wrapper');
    if (wrapper) {
      let overlay = document.getElementById('detail-metadata-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'detail-metadata-overlay';
        overlay.innerHTML = '<div id="detail-metadata-inner"></div>';
        wrapper.appendChild(overlay);
      }
      const inner = overlay.querySelector('#detail-metadata-inner');
      if (inner) {
        inner.innerHTML = fields.map(f =>
          `<div class="meta-row"><div class="meta-label">${f.label}</div><div class="meta-value">${getTranslation(f.value, AppState.language) || '--'}</div></div>`
        ).join('');
      }
    }
  } catch (e) {
    console.warn('renderMetadata overlay failed', e);
  }
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
    // Append to the wrapper so pointer-events rules don't block these buttons
    container.appendChild(btn);

    // Sidebar info box (non-interactive by default)
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

/**
 * Fullscreen helpers
 */
function isFullscreenActive() {
  return !!document.fullscreenElement || !!document.webkitFullscreenElement;
}

function toggleFullscreen() {
  const detailView = $('detail-image-view');
  if (!detailView) return;
  // Use the detail-image-view element as the fullscreen element
  if (!isFullscreenActive()) {
    if (detailView.requestFullscreen) {
      detailView.requestFullscreen().catch(err => console.warn('requestFullscreen failed', err));
    } else if (detailView.webkitRequestFullscreen) {
      detailView.webkitRequestFullscreen();
    }
    detailView.classList.add('fullscreen-active');
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    detailView.classList.remove('fullscreen-active');
    detailView.classList.remove('show-metadata');
  }
}

// Sync UI when the browser triggers fullscreen change directly
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    const detailView = $('detail-image-view');
    if (!detailView) return;
    if (isFullscreenActive()) {
      detailView.classList.add('fullscreen-active');
    } else {
      detailView.classList.remove('fullscreen-active');
      detailView.classList.remove('show-metadata');
    }
  });
}

// Create the fullscreen + metadata toggle buttons inside the image wrapper
function setupDetailControls() {
  try {
    const wrapper = $('detail-image-wrapper');
    if (!wrapper) return;

    // Fullscreen button
    let fsBtn = document.getElementById('btn-fullscreen-toggle');
    if (!fsBtn) {
      fsBtn = document.createElement('button');
      fsBtn.id = 'btn-fullscreen-toggle';
      fsBtn.setAttribute('aria-label', 'Toggle fullscreen');
      fsBtn.textContent = 'Fullscreen';
      fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
      wrapper.appendChild(fsBtn);
    }

    // Metadata toggle (small button) — allows showing overlay in fullscreen
    let metaBtn = document.getElementById('btn-metadata-toggle');
    if (!metaBtn) {
      metaBtn = document.createElement('button');
      metaBtn.id = 'btn-metadata-toggle';
      metaBtn.setAttribute('aria-label', 'Toggle metadata');
      metaBtn.textContent = 'Meta';
      metaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const detailView = $('detail-image-view');
        if (!detailView) return;
        detailView.classList.toggle('show-metadata');
      });
      wrapper.appendChild(metaBtn);
    }

    // Ensure the image double-click is wired (renderImage also sets ondblclick),
    // but set a gentle cursor hint for users on desktop
    const imgEl = $('detail-image');
    if (imgEl) imgEl.style.cursor = 'zoom-in';
  } catch (e) {
    console.warn('setupDetailControls failed', e);
  }
}
