/**
 * render-detail.js
 * Logic for Detail View, Brutalist Nodes, and Geometric Hotspots.
 */
import { $, pad, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState, stickyNotes, updateHash } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';
import { getTranslation } from './translations.js';

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
  const entry = archiveData.find((e) => e.id === entryId);
  if (!entry) return;

  AppState.selectedEntryId   = entryId;
  const imgs = entry.images;
  AppState.currentImageIndex = (typeof imgIdx === 'number') ? Math.min(imgIdx, imgs.length - 1) : 0;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  const detailView = $('detail-image-view');
  if (detailView) detailView.classList.remove('hidden');
  const appRoot = $('app-root');
  if (appRoot) appRoot.classList.add('detail-mode-active');

  renderImage(entry, callbacks);
  preloadAdjacentImages(entry);
  renderBrutalistNodes(entry);
  renderStickyOverlay(entry);
  renderMetadataGrid(entry);
  renderHotspots(entry, $('detail-image-wrapper'));
  setupSwipeGestures(archiveData, callbacks);

  // Setup control panel listeners
  setupDetailControls();

  if (callbacks) {
    if (callbacks.updateHeaderTelemetry) callbacks.updateHeaderTelemetry(`ACCESSING_NODE: ${entry.id.toUpperCase()}`);
    if (callbacks.addRecentlyViewed)     callbacks.addRecentlyViewed(entryId);
    if (callbacks.updateBookmarkUI)      callbacks.updateBookmarkUI(entryId);
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
  updateStatusBar(archiveData);
}

export function navigateEntry(direction, archiveData, callbacks) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const imgs = entry.images;
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

function renderImage(entry, callbacks) {
  const imgs = entry.images;
  const currentImgObj = imgs[AppState.currentImageIndex];
  const currentImgSrc = resolveImgSrc(currentImgObj);

  const imgEl = $('detail-image');
  if (imgEl) {
    imgEl.src = '';
    imgEl.onerror = () => { imgEl.src = BROKEN_ASSET; };
    imgEl.onload = () => {
      if (callbacks && callbacks.extractAccentColor) callbacks.extractAccentColor(imgEl);
    };
    imgEl.src = currentImgSrc;
    imgEl.alt = entry.title || entry.id;
  }

  const titleEl = $('active-entry-title');
  if (titleEl) {
    const brand = getTranslation(entry.tags.brand, AppState.language);
    const currentImgObj2 = imgs[AppState.currentImageIndex];
    const hotspotCount = (currentImgObj2?.hotspots || []).length;
    const annLabel = hotspotCount === 1
      ? getTranslation('hotspot_annotation', AppState.language)
      : getTranslation('hotspot_annotations', AppState.language);
    const hotspotSuffix = hotspotCount > 0 ? ` · ${hotspotCount} ${annLabel}` : '';
    titleEl.textContent = `${brand} ${entry.year} [${pad(AppState.currentImageIndex + 1)}/${pad(imgs.length)}]${hotspotSuffix}`;
  }
}

/**
 * renderBrutalistNodes
 * Injects the Tricolour sticky notes into the sidebar.
 */
function renderBrutalistNodes(entry) {
  const container = $('sticky-note-container');
  if (!container) return;

  // We want to keep the Analytical Payload div, so we clear only other nodes
  const existingNodes = container.querySelectorAll('.brutalist-node:not(#analytical-payload)');
  existingNodes.forEach(n => n.remove());

  const lang = AppState.language;
  const t = (k) => getTranslation(k, lang);

  const nodeTypes = [
    { id: 'provenance', label: '[ PROVENANCE ]', class: 'node-provenance' },
    { id: 'critique',   label: '[ CRITIQUE ]',   class: 'node-critique'   },
    { id: 'strategy',   label: '[ STRATEGY ]',   class: 'node-strategy'   }
  ];

  nodeTypes.forEach(type => {
    let text = entry.notes?.[type.id] || '';
    text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();

    if (text) {
      const node = document.createElement('div');
      node.className = `brutalist-node ${type.class}`;
      node.innerHTML = `
        <span class="node-label">${type.label}</span>
        <div class="node-body">${text}</div>
      `;
      container.appendChild(node);
    }
  });
}

/**
 * renderStickyOverlay
 * Tricolour square triggers (top-right of image). Clicking a square
 * reveals its note content in the right-side #sticky-note-panel.
 */
function renderStickyOverlay(entry) {
  const squaresEl = $('sticky-squares');
  if (!squaresEl) return;
  squaresEl.innerHTML = '';

  // Reset panel state for new entry
  const panel      = $('sticky-note-panel');
  const panelLabel = $('sticky-panel-label');
  const panelBody  = $('sticky-panel-body');
  const panelHdr   = $('sticky-panel-header');
  if (panel) panel.classList.remove('visible');

  const lang = AppState.language;
  const t    = (k) => getTranslation(k, lang);

  const noteTypes = [
    { id: 'provenance', label: t('note_provenance') || 'AUDIT PROVENANCE',  cls: 'sq-provenance', bg: '#E6FF00', fg: '#000' },
    { id: 'critique',   label: t('note_critique')   || 'FORENSIC CRITIQUE', cls: 'sq-critique',   bg: '#FF0000', fg: '#fff' },
    { id: 'strategy',   label: t('note_strategy')   || 'ISOLATE STRATEGY',  cls: 'sq-strategy',   bg: '#0000FF', fg: '#fff' }
  ];

  let activeId = null;

  const closePanel = () => {
    if (panel) panel.classList.remove('visible');
    squaresEl.querySelectorAll('.sticky-square').forEach(s => s.classList.remove('active'));
    activeId = null;
  };

  const closeBtn = $('btn-close-sticky-panel');
  if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closePanel(); };

  noteTypes.forEach(type => {
    let text = entry.notes?.[type.id] || '';
    text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();
    if (!text) return;

    const sq = document.createElement('button');
    sq.className = `sticky-square ${type.cls}`;
    sq.title = type.label;
    sq.setAttribute('aria-label', type.label);

    sq.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeId === type.id) { closePanel(); return; }
      activeId = type.id;

      squaresEl.querySelectorAll('.sticky-square').forEach(s => s.classList.remove('active'));
      sq.classList.add('active');

      if (panelHdr) {
        panelHdr.style.background  = type.bg;
        panelHdr.style.color       = type.fg;
        panelHdr.style.borderColor = type.fg === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
      }
      if (panelLabel) { panelLabel.textContent = type.label; panelLabel.style.color = type.fg; }
      if (closeBtn)   closeBtn.style.color = type.fg;
      if (panelBody)  panelBody.textContent = text;
      if (panel)      panel.classList.add('visible');
    });

    squaresEl.appendChild(sq);
  });
}

function renderMetadataGrid(entry) {
  const grid = $('metadata-grid');
  if (!grid || !entry.tags) return;
  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);
  const fields = [
    { label: t('tax_era'),        value: entry.tags.era },
    { label: t('tax_politics'),   value: entry.tags.politics },
    { label: t('tax_theories'),   value: entry.tags.theories },
    { label: t('tax_materials'),  value: entry.tags.materials }
  ];
  grid.innerHTML = fields.map(f =>
    `<div class="space-y-1">
      <div class="text-[8px] font-mono uppercase tracking-[0.2em] text-white/40">${f.label}</div>
      <div class="text-[9px] font-mono uppercase tracking-wide text-white">${getTranslation(f.value, lang) || '--'}</div>
    </div>`
  ).join('');
}

/**
 * renderHotspots
 * Geometric crosshair targets.
 */
function renderHotspots(entry, container) {
  if (!container) return;
  container.querySelectorAll('.hotspot-btn').forEach(el => el.remove());

  // Reset payload state on every new entry render
  const payloadEl = $('analytical-payload');
  if (payloadEl) {
    payloadEl.classList.add('hidden');
    payloadEl.classList.remove('permanent-payload', 'expand-active');
  }

  const imgs = entry.images;
  const currentImgObj = imgs[AppState.currentImageIndex];
  const hotspots = currentImgObj?.hotspots || [];

  hotspots.forEach((spot, i) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot-btn';
    btn.style.left = spot.x + '%';
    btn.style.top  = spot.y + '%';
    btn.setAttribute('data-index', i);
    btn.innerHTML = '<div class="hotspot-target"></div>';
    
    // Interaction
    btn.addEventListener('mouseenter', () => showPayload(spot));
    btn.addEventListener('mouseleave', () => hidePayload());
    btn.addEventListener('click', () => {
      showPayload(spot, true);
    });

    container.appendChild(btn);
  });
}

function showPayload(spot, permanent = false) {
  const payload = $('analytical-payload');
  const content = $('payload-content');
  if (!payload || !content) return;

  let text = spot.description || '';
  text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();
  
  content.innerHTML = `
    <div class="text-[10px] font-bold mb-2 border-b border-black/10 pb-1">${spot.label.toUpperCase()}</div>
    <div class="text-[10px] leading-relaxed">${text}</div>
  `;
  payload.classList.remove('hidden');
  
  if (permanent) {
    payload.classList.add('permanent-payload');
    payload.classList.add('expand-active');
  }

  // Click to close/shrink
  payload.onclick = (e) => {
    e.stopPropagation();
    payload.classList.remove('permanent-payload');
    payload.classList.remove('expand-active');
    payload.classList.add('hidden');
  };
}

function hidePayload() {
  const payload = $('analytical-payload');
  if (!payload || payload.classList.contains('permanent-payload')) return;
  payload.classList.add('hidden');
}

function preloadAdjacentImages(entry) {
  const imgs = entry.images;
  const idx = AppState.currentImageIndex;
  [-1, 1].forEach(offset => {
    const adj = imgs[idx + offset];
    if (adj) {
      const img = new Image();
      img.src = resolveImgSrc(adj);
    }
  });
}

let swipeTouchStartX = null;
let swipeTouchStartY = null;
let swipeCallbackRef = null;

function setupSwipeGestures(archiveData, callbacks) {
  const wrapper = $('detail-image-wrapper');
  if (!wrapper) return;

  if (swipeCallbackRef) {
    wrapper.removeEventListener('touchstart', swipeCallbackRef.start);
    wrapper.removeEventListener('touchend', swipeCallbackRef.end);
  }

  const onStart = (e) => {
    swipeTouchStartX = e.touches[0].clientX;
    swipeTouchStartY = e.touches[0].clientY;
  };
  const onEnd = (e) => {
    if (swipeTouchStartX === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY;
    swipeTouchStartX = null;
    swipeTouchStartY = null;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    navigateEntry(dx < 0 ? 1 : -1, archiveData, callbacks);
  };

  wrapper.addEventListener('touchstart', onStart, { passive: true });
  wrapper.addEventListener('touchend', onEnd, { passive: true });
  swipeCallbackRef = { start: onStart, end: onEnd };
}

function setupDetailControls() {
  const fsBtn = $('btn-fullscreen-toggle');
  if (fsBtn) {
    fsBtn.onclick = () => toggleFullscreen();
  }

  const taxToggle = $('btn-tax-toggle');
  if (taxToggle) {
    const lang = AppState.language;
    taxToggle.onclick = () => {
      const sidebar = $('detail-metadata-sidebar');
      sidebar.classList.toggle('hidden');
      taxToggle.textContent = sidebar.classList.contains('hidden') 
        ? getTranslation('btn_visualise_tax', lang)
        : getTranslation('btn_hide_tax', lang);
    };
  }
  // Note: btn-back-grid is wired in app.js's setupEventListeners().
}

function toggleFullscreen() {
  const detailView = $('detail-image-view');
  if (!detailView) return;
  if (!document.fullscreenElement) {
    detailView.requestFullscreen().catch(err => console.warn(err));
  } else {
    document.exitFullscreen();
  }
}
