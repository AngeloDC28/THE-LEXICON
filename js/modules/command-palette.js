/**
 * command-palette.js
 * Logic for the CMD+K command palette.
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

let cmdSelectedIndex = -1;
let cmdResults = [];
let cmdScope = 'all'; // 'all' | 'entries' | 'tags' | 'commands'

export function toggleCmdPalette(archiveData, callbacks) {
  const modal = $('cmd-palette');
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    cmdScope = 'all';
    updateScopePills();
    const input = $('cmd-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    renderCmdResults('', archiveData, callbacks);
  } else {
    modal.classList.add('hidden');
  }
  // Bind scope pill clicks (once, after modal shown)
  document.querySelectorAll('.cmd-scope-pill').forEach(pill => {
    pill.onclick = () => {
      cmdScope = pill.dataset.scope;
      updateScopePills();
      const q = $('cmd-input')?.value || '';
      renderCmdResults(q, archiveData, callbacks);
    };
  });
}

function updateScopePills() {
  document.querySelectorAll('.cmd-scope-pill').forEach(p => {
    const isActive = p.dataset.scope === cmdScope;
    p.classList.toggle('active', isActive);
    p.setAttribute('aria-pressed', String(isActive));
  });
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

// Analytical tag values to surface as "tag" results
const ALL_POLITICS = [
  'Queer Theory & Subcultural Systems','Gender Deconstruction & Fluidity',
  'Body Politics & Corporeal Interventions','Class Dynamics & Anti-Elitism',
  'Post-Colonialism & Diasporic Narratives','Anti-Consumerism & Institutional Critique',
  'Activism & Crisis Response','Globalisation & Cultural Hybridity',
  'Surveillance & Architectural Shielding','Ecological Politics & Resource Extraction',
  'Labour Politics & Industrial Production','Feminist Theory & The Subverted Gaze',
  'Racial Identity & Representation','Censorship & Provocation',
  'Techno-Politics & Digital Identities',
];

function closePalette() {
  const modal = $('cmd-palette');
  if (modal) modal.classList.add('hidden');
}

function updateResultCount(total) {
  const el = $('cmd-result-count');
  if (!el) return;
  el.textContent = total > 0 ? `${total} RESULTS` : '';
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
      </div>
      <div class="cmd-group-head">QUICK COMMANDS</div>
      ${buildCommandItems(query)}`;
    cmdResults = [];
    updateResultCount(0);
    bindCmdActions(container, archiveData, callbacks);
    return;
  }

  const q = query.toLowerCase();
  const { ops, freeText } = parseFieldOps(query);

  const showTags     = cmdScope === 'all' || cmdScope === 'tags';
  const showEntries  = cmdScope === 'all' || cmdScope === 'entries';
  const showCommands = cmdScope === 'all' || cmdScope === 'commands';

  // 1. Matching analytical tags
  const matchedTags = showTags ? ALL_POLITICS.filter(t => t.toLowerCase().includes(q)) : [];

  // 2. Matching entries
  const entryMatches = showEntries ? archiveData.filter(e => matchesEntry(e, ops, freeText)).slice(0, 8) : [];
  cmdResults = entryMatches;

  // 3. Quick commands
  const cmds = showCommands ? buildCommandItems(query) : '';

  const totalCount = matchedTags.length + entryMatches.length;
  updateResultCount(totalCount);

  if (matchedTags.length === 0 && entryMatches.length === 0 && !cmds) {
    container.innerHTML = `<div class="p-4 text-xs opacity-50 uppercase text-center">${getTranslation('cmd_no_results', AppState.language)}</div>`;
    bindCmdActions(container, archiveData, callbacks);
    return;
  }
  if (matchedTags.length === 0 && entryMatches.length === 0) {
    container.innerHTML = `<div class="p-4 text-xs opacity-50 uppercase text-center">${getTranslation('cmd_no_results', AppState.language)}</div>
      <div class="cmd-group-head">QUICK COMMANDS</div>${cmds}`;
    bindCmdActions(container, archiveData, callbacks);
    return;
  }

  let html = '';

  // Tag group
  if (matchedTags.length) {
    html += `<div class="cmd-group-head">ANALYTICAL TAG</div>`;
    matchedTags.slice(0, 3).forEach(tag => {
      const tagCount = archiveData.filter(e => (e.tags?.politics || '').toLowerCase().includes(tag.toLowerCase())).length;
      const shortTag = tag.split('&')[0].trim();
      html += `<div class="cmd-item cmd-tag-item p-3 px-4 cursor-pointer flex items-center gap-3" role="option" aria-selected="false" data-cmd-action="filter-tag" data-cmd-val="${tag}">
        <div class="text-[10px] font-bold opacity-30 shrink-0 font-mono">#</div>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-bold tracking-wide" style="color:var(--c-corporeal)">${tag}</div>
          <div class="text-[9px] opacity-50 uppercase tracking-wider mt-0.5">${tagCount} ENTRIES · ${shortTag.toUpperCase()}</div>
        </div>
        <div class="text-[9px] opacity-40 ml-2 shrink-0 tracking-wider">TAG</div>
      </div>`;
    });
  }

  // Entry group
  if (entryMatches.length) {
    html += `<div class="cmd-group-head">ENTRIES</div>`;
    entryMatches.forEach((entry, i) => {
      const brand = entry.tags?.brand || '—';
      const year  = entry.year || '----';
      const season = entry.season || 'ARCHIVE';
      const id    = `N-${entry.id.slice(0,6).toUpperCase()}`;
      const politics = (entry.tags?.politics || '').split('&')[0].trim().toUpperCase().slice(0, 32);
      // Use critique note as the "hook" text, or fall back to title
      const hook = entry.notes?.critique
        ? entry.notes.critique.slice(0, 72) + (entry.notes.critique.length > 72 ? '…' : '')
        : (entry.title ? entry.title.slice(0, 72) : `${brand} · ${season} · ${year}`);
      html += `<div class="cmd-item p-3 px-4 cursor-pointer flex items-start gap-3" role="option" aria-selected="false" data-index="${i}" data-entry-id="${entry.id}">
        <div class="text-[10px] font-bold opacity-30 mt-0.5 shrink-0 font-mono">N</div>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-bold tracking-wide truncate">${brand.toUpperCase()} · ${season.toUpperCase()} · ${year}</div>
          <div class="text-[9px] opacity-60 mt-0.5 truncate font-normal normal-case">${hook}</div>
          <div class="text-[8px] opacity-35 uppercase tracking-wider mt-0.5">${id} · ${politics}</div>
        </div>
        <div class="text-[10px] opacity-40 ml-1 shrink-0" aria-hidden="true">↵</div>
      </div>`;
    });
  }

  // Commands group
  if (cmds) html += `<div class="cmd-group-head">COMMANDS</div>${cmds}`;

  container.innerHTML = html;
  bindCmdActions(container, archiveData, callbacks);
}

function buildCommandItems(query) {
  const q = query.toLowerCase();
  const items = [
    { icon: '⊞', label: 'Switch to VISUAL mode', action: 'visual-mode' },
    { icon: '≡', label: 'Switch to INDEX mode', action: 'index-mode' },
    { icon: '⌘', label: 'Open keyboard shortcuts', action: 'kbd-help' },
  ];
  if (q) {
    items.unshift(
      { icon: '⧉', label: `Filter archive by tag: ${query}`, action: 'filter-tag', val: query },
    );
  }
  return items.map(item => `
    <div class="cmd-item cmd-cmd-item p-3 px-4 cursor-pointer flex items-center gap-3" role="option" aria-selected="false" data-cmd-action="${item.action}" ${item.val ? `data-cmd-val="${item.val}"` : ''}>
      <span class="text-[14px] opacity-40" aria-hidden="true">${item.icon}</span>
      <span class="text-[10px] uppercase tracking-wide">${item.label}</span>
      <span class="ml-auto text-[9px] opacity-30 tracking-wider" aria-hidden="true">RUN →</span>
    </div>`).join('');
}

function bindCmdActions(container, archiveData, callbacks) {
  // Entry navigation
  container.querySelectorAll('.cmd-item[data-entry-id]').forEach((el) => {
    el.addEventListener('click', () => {
      closePalette();
      window.location.hash = `detail/${el.dataset.entryId}/0`;
    });
  });

  // Tag filter
  container.querySelectorAll('[data-cmd-action="filter-tag"]').forEach(el => {
    el.addEventListener('click', () => {
      closePalette();
      AppState.filters.politics = el.dataset.cmdVal || '';
      document.dispatchEvent(new CustomEvent('lexicon-refresh'));
    });
  });

  // Mode switches
  container.querySelector('[data-cmd-action="visual-mode"]')?.addEventListener('click', () => {
    closePalette();
    document.dispatchEvent(new CustomEvent('lexicon-set-view-mode', { detail: 'visual' }));
  });
  container.querySelector('[data-cmd-action="index-mode"]')?.addEventListener('click', () => {
    closePalette();
    document.dispatchEvent(new CustomEvent('lexicon-set-view-mode', { detail: 'index' }));
  });
  container.querySelector('[data-cmd-action="kbd-help"]')?.addEventListener('click', () => {
    closePalette();
    document.dispatchEvent(new CustomEvent('lexicon-kbd-help'));
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
  const items = document.querySelectorAll('.cmd-item');
  items.forEach((el, i) => {
    const isSelected = i === cmdSelectedIndex;
    el.classList.toggle('selected', isSelected);
    el.setAttribute('aria-selected', String(isSelected));
    if (isSelected) {
      // Update aria-activedescendant on the input so SR users hear the choice.
      const input = document.getElementById('cmd-input');
      if (input) {
        if (!el.id) el.id = `cmd-item-${i}`;
        input.setAttribute('aria-activedescendant', el.id);
      }
      // Scroll selected item into view.
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  if (cmdSelectedIndex < 0) {
    document.getElementById('cmd-input')?.removeAttribute('aria-activedescendant');
  }
}
