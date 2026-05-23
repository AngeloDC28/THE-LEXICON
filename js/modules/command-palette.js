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

// Phase 2: parse field operators from query (e.g. "tag:corporeal year:1999")
function parseFieldOps(query) {
  const ops = {};
  let rest = query;
  const re = /(tag|year|designer|brand|movement|era|format):([^\s]+)/gi;
  let m;
  while ((m = re.exec(query)) !== null) {
    ops[m[1].toLowerCase()] = m[2].toLowerCase();
    rest = rest.replace(m[0], '').trim();
  }
  return { ops, freeText: rest.toLowerCase().trim() };
}

function matchesEntry(entry, ops, freeText) {
  if (!entry || !entry.tags) return false;
  const t = entry.tags;
  // Field op filters
  if (ops.year && String(entry.year || '').toLowerCase() !== ops.year) return false;
  if (ops.designer && !(t.brand || '').toLowerCase().includes(ops.designer)) return false;
  if (ops.brand && !(t.brand || '').toLowerCase().includes(ops.brand)) return false;
  if (ops.tag && !(t.politics || '').toLowerCase().includes(ops.tag) && !(t.theories || '').toLowerCase().includes(ops.tag)) return false;
  if (ops.movement && !(t.theories || '').toLowerCase().includes(ops.movement)) return false;
  if (ops.era && !(t.era || '').toLowerCase().includes(ops.era)) return false;
  if (ops.format && !(t.format || '').toLowerCase().includes(ops.format)) return false;
  // Free text against everything
  if (freeText) {
    const searchable = [
      entry.title || '',
      entry.season || '',
      String(entry.year || ''),
      ...Object.values(t || {}),
      ...Object.values(entry.notes || {})
    ].join(' ').toLowerCase();
    if (!searchable.includes(freeText)) return false;
  }
  return true;
}

export function renderCmdResults(query, archiveData, callbacks) {
  const container = $('cmd-results');
  if (!container) return;
  cmdSelectedIndex = -1;
  if (!query.trim()) {
    container.innerHTML = `
      <div class="p-4 text-[10px] opacity-50 uppercase text-center font-mono leading-relaxed">
        ${getTranslation('cmd_placeholder', AppState.language)}<br/>
        <span class="opacity-70">Tip: try <kbd class="border border-current px-1 mx-0.5">tag:corporeal</kbd> <kbd class="border border-current px-1 mx-0.5">year:1999</kbd> <kbd class="border border-current px-1 mx-0.5">designer:mcqueen</kbd></span>
      </div>`;
    cmdResults = [];
    return;
  }

  const { ops, freeText } = parseFieldOps(query);
  cmdResults = archiveData.filter(e => matchesEntry(e, ops, freeText)).slice(0, 12);

  if (cmdResults.length === 0) {
    container.innerHTML = `<div class="p-4 text-xs opacity-50 uppercase text-center">${getTranslation('cmd_no_results', AppState.language)}</div>`;
    return;
  }

  let html = '';
  cmdResults.forEach((entry, i) => {
    const brand = entry.tags?.brand || '—';
    const title = entry.title || `${brand} ${entry.season || ''} ${entry.year || ''}`.trim();
    html += `<div class="cmd-item p-3 px-4 cursor-pointer flex justify-between items-center transition-colors" data-index="${i}" data-entry-id="${entry.id}">
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold uppercase tracking-wide">${brand}</div>
        <div class="text-[10px] opacity-60 uppercase truncate">${entry.year || '----'} &middot; ${entry.season || 'ARCHIVE'} &middot; ${title}</div>
      </div>
      <div class="text-[10px] opacity-40 ml-2 shrink-0">↵</div>
    </div>`;
  });
  container.innerHTML = html;

  // Phase 2: click-to-navigate
  container.querySelectorAll('.cmd-item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.entryId;
      if (id) {
        const modal = $('cmd-palette');
        if (modal) modal.classList.add('hidden');
        window.location.hash = `detail/${id}/0`;
      }
    });
  });
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
