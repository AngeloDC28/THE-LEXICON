/**
 * command-palette.js
 * Logic for the CMD+K command palette.
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

let cmdSelectedIndex = -1;
let cmdResults = [];

export function toggleCmdPalette(archiveData, callbacks) {
  const modal = $('cmd-palette');
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    const input = $('cmd-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    renderCmdResults('', archiveData);
  } else {
    modal.classList.add('hidden');
  }
}

export function renderCmdResults(query, archiveData) {
  const container = $('cmd-results');
  if (!container) return;
  cmdSelectedIndex = -1;
  if (!query.trim()) {
    container.innerHTML = `<div class="p-4 text-xs opacity-50 uppercase text-center">${getTranslation('cmd_placeholder', AppState.language)}</div>`;
    cmdResults = [];
    return;
  }
  
  const q = query.toLowerCase();
  cmdResults = archiveData.filter(entry => {
    if (!entry) return false;
    const searchable = [
      entry.title || '',
      entry.season || '',
      entry.year ? String(entry.year) : '',
      entry.description || '',
      ...(entry.tags ? Object.values(entry.tags) : []),
      ...(entry.notes ? Object.values(entry.notes) : [])
    ].join(' ').toLowerCase();
    return searchable.includes(q);
  }).slice(0, 10);

  if (cmdResults.length === 0) {
    container.innerHTML = `<div class="p-4 text-xs opacity-50 uppercase text-center">${getTranslation('cmd_no_results', AppState.language)}</div>`;
    return;
  }

  let html = '';
  cmdResults.forEach((entry, i) => {
    html += `<div class="cmd-item p-3 px-4 cursor-pointer flex justify-between items-center transition-colors" data-index="${i}">
      <div>
        <div class="text-xs font-bold uppercase tracking-wide">${entry.tags.brand}</div>
        <div class="text-[10px] opacity-60 uppercase">${entry.year} &middot; ${entry.season}</div>
      </div>
      <div class="text-[10px] opacity-40">↵</div>
    </div>`;
  });
  container.innerHTML = html;
}

export function handleCmdKeydown(e, archiveData, callbacks) {
  const modal = $('cmd-palette');
  if (!modal || modal.classList.contains('hidden')) return;

  if (e.key === 'Escape') toggleCmdPalette(archiveData, callbacks);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cmdSelectedIndex = Math.min(cmdSelectedIndex + 1, cmdResults.length - 1);
    updateCmdSelection();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    cmdSelectedIndex = Math.max(cmdSelectedIndex - 1, 0);
    updateCmdSelection();
  }
  if (e.key === 'Enter' && cmdSelectedIndex >= 0 && cmdSelectedIndex < cmdResults.length) {
    toggleCmdPalette(archiveData, callbacks);
    if (callbacks && callbacks.openDetail) {
      callbacks.openDetail(cmdResults[cmdSelectedIndex].id);
    }
  }
}

function updateCmdSelection() {
  document.querySelectorAll('.cmd-item').forEach((el, i) => {
    if (i === cmdSelectedIndex) el.classList.add('selected');
    else el.classList.remove('selected');
  });
}
