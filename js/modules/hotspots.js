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
      const desc  = $('dock-desc');
      if (title) title.textContent = spot.label;
      if (desc)  desc.textContent  = spot.description;
      toggleMobileDock(true);
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
  document.querySelectorAll('#active-entry-hotspots > div').forEach(box => {
    box.classList.remove('border-black', 'dark:border-white', 'bg-black/10', 'dark:bg-white/10');
  });
  document.querySelectorAll('.hotspot-btn').forEach(btn => btn.classList.remove('active'));
  if (window.innerWidth < 768) toggleMobileDock(false);
}

export function toggleMobileHotspots() {
  const btn    = $('btn-toggle-hotspots-mobile');
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
    dock.classList.remove('translate-y-full', 'hidden');
    dock.classList.add('flex');
  } else {
    dock.classList.add('translate-y-full');
  }
}
