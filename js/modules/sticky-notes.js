/**
 * sticky-notes.js
 * Logic for archival notes and mobile interaction.
 */

import { $ } from './core-utils.js';
import { AppState, stickyNotes } from './core-state.js';
import { toggleMobileDock } from './hotspots.js';
import { getTranslation } from './translations.js';

export function initDockInteractions() {
  // Mobile dock closer handled in app.js delegation
}

export function setStickyNote(type, entry) {
  const noteData = stickyNotes[type];
  if (!noteData) return;

  const body = entry.notes?.[type] || 'NO_DATA_AVAILABLE_FOR_THIS_PARAMETER';
  
  if (window.innerWidth >= 768) {
    const panel = $('sticky-note-panel');
    const titleEl = $('sticky-note-title');
    const bodyEl = $('sticky-note-body');

    if (panel && titleEl && bodyEl) {
      titleEl.textContent = getTranslation(`note_${type}`, AppState.language);
      bodyEl.textContent = body;
      panel.style.backgroundColor = noteData.color;
      panel.classList.add('visible');
    }
  } else {
    // Mobile dock
    const title = $('dock-title');
    const desc = $('dock-desc');
    const dock = $('master-dock');
    
    if (title && desc && dock) {
      title.textContent = getTranslation(`note_${type}`, AppState.language);
      desc.textContent = body;
      dock.style.backgroundColor = noteData.color;
      
      // Dynamic text color for accessibility
      const isAcid = noteData.color === '#E6FF00';
      title.style.color = isAcid ? '#000' : '#FFF';
      desc.style.color = isAcid ? '#000' : '#FFF';
      
      toggleMobileDock(true);
    }
  }
}

export function toggleMobileDockLocal(show) {
  toggleMobileDock(show);
}
