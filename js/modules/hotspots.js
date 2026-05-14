/**
 * hotspots.js
 * Logic for hotspot popups and interaction.
 *
 * FIX: Removed direct import of archiveData from database.js — that path
 * (../../database.js) resolves incorrectly in the module graph when loaded
 * from the live site, causing a silent module-load failure that breaks every
 * hotspot interaction. archiveData is now received as a parameter via
 * initHotspotInteractions(archiveData) and stored in module scope.
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';

// Module-scoped reference — set once by initHotspotInteractions(archiveData)
let _archiveData = [];

export function initHotspotInteractions(archiveData) {
  // Store reference so showHotspot() can access entry data without re-importing
  if (Array.isArray(archiveData)) _archiveData = archiveData;

  const detailView = $('detail-image-view');
  if (!detailView) return;

  // Delegate click on hotspot buttons
  detailView.addEventListener('click', (e) => {
    const btn = e.target.closest('.hotspot-btn');
    if (btn) {
      const idx = parseInt(btn.dataset.index);
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
  console.log('LEXICON_ACTION: HOTSPOT_SELECT', index);

  // Desktop: highlight sidebar info box
  const infoBoxes = document.querySelectorAll('#active-entry-hotspots > div');
  if (infoBoxes.length > 0) {
    infoBoxes.forEach((box, i) => {
      if (i === index) {
        box.classList.add('active-hotspot-box', 'border-black', 'dark:border-white', 'bg-black/10', 'dark:bg-white/10');
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        box.classList.remove('active-hotspot-box', 'border-black', 'dark:border-white', 'bg-black/10', 'dark:bg-white/10');
      }
    });
  }

  // Mobile: populate and show dock
  const entry = _archiveData.find(e => e.id === AppState.selectedEntryId);
  if (entry) {
    const imgs = entry.images || [{ src: entry.imageUrl }];
    const hotspots = imgs[AppState.currentImageIndex]?.hotspots || entry.hotspots || [];
    const spot = hotspots[index];
    if (spot && window.innerWidth < 1024) {
      const title = $('dock-title');
      const desc = $('dock-desc');
      if (title) title.textContent = spot.label;
      if (desc) desc.textContent = spot.description;
      toggleMobileDock(true);
    }
  }

  // Highlight button
  const btns = document.querySelectorAll('.hotspot-btn');
  btns.forEach((btn, i) => {
    if (parseInt(btn.dataset.index) === index) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

export function cleanupHotspots() {
  AppState.activeHotspot = null;
  const infoBoxes = document.querySelectorAll('#active-entry-hotspots > div');
  infoBoxes.forEach(box => {
    box.classList.remove('border-black', 'dark:border-white', 'bg-black/10', 'dark:bg-white/10');
  });
  const btns = document.querySelectorAll('.hotspot-btn');
  btns.forEach(btn => btn.classList.remove('active'));
  if (window.innerWidth < 768) {
    toggleMobileDock(false);
  }
}

export function toggleMobileHotspots() {
  const btn = $('btn-toggle-hotspots-mobile');
  const detail = $('detail-image-view');
  if (!detail) return;
  const isVisible = detail.classList.contains('show-hotspots');
  if (isVisible) {
    detail.classList.remove('show-hotspots');
    if (btn) btn.textContent = 'HOTSPOTS_OFF';
    cleanupHotspots();
  } else {
    detail.classList.add('show-hotspots');
    if (btn) btn.textContent = 'HOTSPOTS_ON';
  }
}

export function toggleMobileDock(show) {
  const dock = $('master-dock');
  if (!dock) return;
  if (show) {
    dock.classList.remove('translate-y-full');
    dock.classList.remove('hidden');
    dock.classList.add('flex');
  } else {
    dock.classList.add('translate-y-full');
  }
}
