/**
 * sticky-notes.js
 * Logic for archival notes and mobile interaction.
 */

import { $ } from './core-utils.js';
import { AppState, stickyNotes } from './core-state.js';
import { toggleMobileDock } from './hotspots.js';

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
      titleEl.textContent = noteData.title;
      bodyEl.textContent = body;
      panel.style.backgroundColor = noteData.color;
      panel.classList.add('active');
    }
  } else {
    // Mobile dock
    const title = $('dock-title');
    const desc = $('dock-desc');
    const dock = $('master-dock');
    
    if (title && desc && dock) {
      title.textContent = noteData.title;
      desc.textContent = body;
      dock.style.backgroundColor = noteData.color;
      // Force light text for dark background colors if needed
      title.style.color = '#000';
      desc.style.color = '#000';
      toggleMobileDock(true);
    }
  }
}

export function toggleMobileDockLocal(show) {
  toggleMobileDock(show);
}
