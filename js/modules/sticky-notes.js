/**
 * sticky-notes.js
 * Logic for archival notes and mobile interaction.
 */

import { $ } from './core-utils.js';
import { AppState, stickyNotes } from './core-state.js';
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
  }
}
