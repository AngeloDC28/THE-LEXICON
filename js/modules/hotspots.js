/**
 * hotspots.js
 * Owns all hotspot click interactions: desktop floating payload + mobile bottom sheet.
 *
 * Click events are handled here via a single delegated listener on #detail-image-view.
 * render-detail.js keeps only mouseenter/mouseleave for the desktop hover preview.
 */
import { $ } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

let _archiveData = [];
let _triggerBtn = null;

export function initHotspotInteractions(archiveData) {
  if (Array.isArray(archiveData)) _archiveData = archiveData;

  const detailView = $('detail-image-view');
  if (!detailView) return;

  detailView.addEventListener('click', (e) => {
    const btn = e.target.closest('.hotspot-btn');
    if (btn) {
      e.stopPropagation();
      _triggerBtn = btn;
      const idx = parseInt(btn.dataset.index, 10);
      toggleHotspot(idx);
    }
  });

  const closeSheetBtn = $('btn-close-hotspot-sheet');
  if (closeSheetBtn) {
    closeSheetBtn.addEventListener('click', () => cleanupHotspots());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && AppState.activeHotspot !== null) {
      e.preventDefault();
      cleanupHotspots();
    }
  });
}

export function toggleHotspot(index) {
  if (AppState.activeHotspot === index) {
    cleanupHotspots();
  } else {
    showHotspot(index);
  }
}

function showHotspot(index) {
  AppState.activeHotspot = index;

  const entry = _archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const imgs = entry.images || [{ src: entry.imageUrl }];
  const hotspots = imgs[AppState.currentImageIndex]?.hotspots || entry.hotspots || [];
  const spot = hotspots[index];
  if (!spot) return;

  let text = spot.description || '';
  text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();

  if (window.innerWidth < 1024) {
    // Mobile: slide-up bottom sheet with scrollable, readable text
    const sheet = $('mobile-hotspot-sheet');
    const labelEl = $('mobile-hotspot-sheet-label');
    const bodyEl = $('mobile-hotspot-sheet-body');
    if (sheet && labelEl && bodyEl) {
      labelEl.textContent = spot.label.toUpperCase();
      bodyEl.textContent = text;
      sheet.setAttribute('aria-hidden', 'false');
      sheet.classList.add('open');
      // Move focus to close button so keyboard users can dismiss the sheet
      const closeBtn = $('btn-close-hotspot-sheet');
      if (closeBtn) requestAnimationFrame(() => closeBtn.focus());
    }
  } else {
    // Desktop: permanent floating payload
    const payload = $('analytical-payload');
    const content = $('payload-content');
    if (payload && content) {
      content.innerHTML = `
        <div class="text-[var(--t-mono-xs)] font-bold mb-2 border-b border-black/10 pb-1">${spot.label.toUpperCase()}</div>
        <div class="text-[var(--t-mono-xs)] leading-relaxed">${text}</div>
      `;
      payload.classList.remove('hidden');
      payload.classList.add('permanent-payload', 'expand-active');
      payload.onclick = (e) => {
        e.stopPropagation();
        cleanupHotspots();
      };
    }
  }

  document.querySelectorAll('.hotspot-btn').forEach((btn) => {
    if (parseInt(btn.dataset.index, 10) === index) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

export function cleanupHotspots() {
  const prevTrigger = _triggerBtn;
  _triggerBtn = null;
  AppState.activeHotspot = null;
  document.querySelectorAll('.hotspot-btn').forEach(btn => btn.classList.remove('active'));

  const sheet = $('mobile-hotspot-sheet');
  if (sheet) {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    // Return focus to the hotspot button that opened the sheet
    if (prevTrigger) requestAnimationFrame(() => prevTrigger.focus());
  }

  const payload = $('analytical-payload');
  if (payload) {
    payload.classList.remove('permanent-payload', 'expand-active');
    payload.classList.add('hidden');
  }
}

export function toggleMobileHotspots() {
  const btn = $('btn-toggle-hotspots-mobile');
  const detail = $('detail-image-view');
  if (!detail) return;
  const lang = AppState.language;
  const isVisible = detail.classList.contains('show-hotspots');
  if (isVisible) {
    detail.classList.remove('show-hotspots');
    if (btn) btn.textContent = getTranslation('hotspots_off', lang) || 'HOTSPOTS OFF';
    cleanupHotspots();
  } else {
    detail.classList.add('show-hotspots');
    if (btn) btn.textContent = getTranslation('hotspots_on', lang) || 'HOTSPOTS ON';
  }
}
