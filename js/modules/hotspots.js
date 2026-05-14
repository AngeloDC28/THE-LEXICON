/**
 * hotspots.js
 * Logic for hotspot popups and interaction.
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';

export function initHotspotInteractions() {
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

  // Desktop: Highlight sidebar info box
  const infoBoxes = document.querySelectorAll('#active-entry-hotspots > div');
  infoBoxes.forEach((box, i) => {
    if (i === index) {
      box.classList.add('border-black', 'dark:border-white', 'bg-black/10', 'dark:bg-white/10');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      box.classList.remove('border-black', 'dark:border-white', 'bg-black/10', 'dark:bg-white/10');
    }
  });

  // Mobile: Populate and show dock
  const entry = window.archiveData.find(e => e.id === AppState.selectedEntryId);
  if (entry) {
    const imgs = entry.images || [{src: entry.imageUrl}];
    const hotspots = imgs[AppState.currentImageIndex]?.hotspots || entry.hotspots || [];
    const spot = hotspots[index];
    
    if (spot && window.innerWidth < 768) {
      const title = $('mobile-dock-title');
      const desc = $('mobile-dock-description');
      if (title) title.textContent = spot.label;
      if (desc) desc.textContent = spot.description;
      toggleMobileDock(true);
    }
  }

  // Highlight button
  const btns = document.querySelectorAll('.hotspot-btn');
  btns.forEach((btn, i) => {
    if (i === index) btn.classList.add('active');
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
    btn.textContent = 'HOTSPOTS_OFF';
    cleanupHotspots();
  } else {
    detail.classList.add('show-hotspots');
    btn.textContent = 'HOTSPOTS_ON';
  }
}

export function toggleMobileDock(show) {
  const dock = $('mobile-dock');
  if (!dock) return;

  if (show) {
    dock.classList.remove('translate-y-full');
  } else {
    dock.classList.add('translate-y-full');
  }
}
