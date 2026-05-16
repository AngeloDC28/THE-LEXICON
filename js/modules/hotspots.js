/**
 * hotspots.js
 * Logic for hotspot popups and interaction.
 *
 * FIX 1: Removed direct import of archiveData from database.js — that path
 * resolves incorrectly in the module graph when loaded from the live site,
 * causing a silent module-load failure that breaks every hotspot interaction.
 * archiveData is now received as a parameter via initHotspotInteractions(archiveData).
 *
 * FIX 2: Hotspot buttons were being attached inside renderHotspots() AND getting
 * a second redundant click listener here. Consolidated: render-detail.js attaches
 * the buttons; this module only handles delegation on the container.
 */
import { $ } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

// Module-scoped reference — set once by initHotspotInteractions(archiveData)
let _archiveData = [];

export function initHotspotInteractions(archiveData) {
  if (Array.isArray(archiveData)) _archiveData = archiveData;

  const detailView = $('detail-image-view');
  if (!detailView) return;

  // Single delegated listener — catches buttons rendered at any time
  detailView.addEventListener('click', (e) => {
    const btn = e.target.closest('.hotspot-btn');
    if (btn) {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      toggleHotspot(idx);
    }
  });
}

export function toggleHotspot(index) {
  const isActive = AppState.activeHotspot === index;
  if (isActive) {
    cleanupHotspots();
  } else {
    showHotspot(index);
  }
}

function showHotspot(index) {
  AppState.activeHotspot = index;

  // Mobile: show hotspot info via payload (dock elements not present)
  const entry = _archiveData.find(e => e.id === AppState.selectedEntryId);
  if (entry && window.innerWidth < 1024) {
    const imgs = entry.images || [{ src: entry.imageUrl }];
    const hotspots = imgs[AppState.currentImageIndex]?.hotspots || entry.hotspots || [];
    const spot = hotspots[index];
    if (spot) {
      const payload = $('analytical-payload');
      const content = $('payload-content');
      if (payload && content) {
        let text = spot.description || '';
        text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();
        content.innerHTML = `<div class="text-[10px] font-bold mb-1">${spot.label.toUpperCase()}</div><div class="text-[10px] leading-relaxed">${text}</div>`;
        payload.classList.remove('hidden');
        payload.onclick = () => payload.classList.add('hidden');
      }
    }
  }

  // Highlight active button
  document.querySelectorAll('.hotspot-btn').forEach((btn, i) => {
    if (parseInt(btn.dataset.index, 10) === index) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

export function cleanupHotspots() {
  AppState.activeHotspot = null;
  document.querySelectorAll('.hotspot-btn').forEach(btn => btn.classList.remove('active'));
}

export function toggleMobileHotspots() {
  const btn    = $('btn-toggle-hotspots-mobile');
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
