/**
 * render-index-view.js
 * Phase 2: Brutalist Index View — text-only sortable table mode.
 *
 * Mockup reference: 02-index-view.html / 02-index-view.png
 * Spec: thelexicon-code-review-v2.md §2.1 "Brutalist Index Toggle"
 *
 * Renders a dense data table with: ID, DESIGNER, YEAR, SEASON, ANALYTICAL TAG,
 * PROVENANCE, STATUS. Color-coded analytical tags per the accent palette.
 * Keyboard-navigable (j/k for rows, Enter to open, /, ?, V, I).
 * Toggle persists in localStorage as 'lexicon.view-mode' (visual | index).
 */
import { $, pad } from './core-utils.js';
import { AppState } from './core-state.js';
import { getFilteredEntries } from './search-engine.js';
import { getTranslation } from './translations.js';

// Map politics tag text → color category in the analytical tag palette.
// Falls back to 'provenance' if no match.
const TAG_CATEGORY_MAP = [
  { match: /corporeal|body politic|displaced anatomy|prosthetic/i, key: 'corporeal' },
  { match: /institutional critique|anti-consumer|class dynamics|labour politic/i, key: 'critique' },
  { match: /subcultur|queer theory|punk|gender deconstruction/i, key: 'subculture' },
  { match: /post-colonial|globalisation|cultural hybrid|racial identity/i, key: 'strategy' },
  { match: /techno-politic|surveillance|digital ident|ecological/i, key: 'semiotic' },
  { match: /feminist|the subverted gaze|censorship|activism/i, key: 'provenance' },
];

export function getTagCategory(politicsTag = '') {
  for (const { match, key } of TAG_CATEGORY_MAP) {
    if (match.test(politicsTag)) return key;
  }
  return 'provenance';
}

// Extract a short label from a long politics tag.
// "Body Politics & Corporeal Interventions" → "Corporeal Intervention"
function shortTagLabel(politicsTag = '') {
  const first = politicsTag.split('|')[0].trim();
  const cat = getTagCategory(first);
  const labelMap = {
    corporeal: 'Corporeal Intervention',
    critique: 'Institutional Critique',
    subculture: 'Subcultural Codification',
    strategy: 'Strategic Appropriation',
    semiotic: 'Semiotic Sabotage',
    provenance: 'Historical Lineage',
  };
  return labelMap[cat] || first;
}

let _focusedRowIndex = 0;

// { col: 'year'|'designer'|'tag'|'season', dir: 'asc'|'desc' }
let _indexSort = { col: 'year', dir: 'desc' };
// Reference to archiveData for re-sorting without full re-render
let _lastArchiveData = null;

const SORT_COLS = {
  year:     { label: 'YEAR',             width: '70px'  },
  designer: { label: 'DESIGNER / BRAND', width: '200px' },
  tag:      { label: 'ANALYTICAL TAG',   width: '240px' },
  season:   { label: 'SEASON',           width: '140px' },
};

function sortEntries(entries, lang) {
  return [...entries].sort((a, b) => {
    const dir = _indexSort.dir === 'asc' ? 1 : -1;
    switch (_indexSort.col) {
      case 'designer':
        return dir * (a.tags?.brand || '').localeCompare(b.tags?.brand || '');
      case 'season':
        return dir * (a.season || '').localeCompare(b.season || '');
      case 'tag':
        return dir * (a.tags?.politics || '').localeCompare(b.tags?.politics || '');
      case 'year':
      default:
        return dir * ((a.year || 0) - (b.year || 0));
    }
  });
}

function sortIndicator(col) {
  if (_indexSort.col !== col) return '<span class="sort-icon" aria-hidden="true">↕</span>';
  return `<span class="sort-icon active" aria-hidden="true">${_indexSort.dir === 'asc' ? '↑' : '↓'}</span>`;
}

function buildHeaderRow() {
  const cols = [
    { key: null,       label: 'ID',         width: '90px'  },
    { key: 'designer', label: 'DESIGNER / BRAND', width: '200px' },
    { key: 'year',     label: 'YEAR',        width: '70px'  },
    { key: 'season',   label: 'SEASON',      width: '140px' },
    { key: 'tag',      label: 'ANALYTICAL TAG', width: '240px' },
    { key: null,       label: 'PROVENANCE',  width: null    },
    { key: null,       label: 'STATUS',      width: '120px' },
  ];
  return cols.map(({ key, label, width }) => {
    const w = width ? ` style="width:${width};"` : '';
    if (!key) return `<th scope="col"${w}>${label}</th>`;
    const active = _indexSort.col === key ? ' sort-active' : '';
    const ariaSort = _indexSort.col === key
      ? (_indexSort.dir === 'asc' ? 'ascending' : 'descending')
      : 'none';
    return `<th scope="col"${w} class="sortable${active}" data-sort-col="${key}" aria-sort="${ariaSort}" tabindex="0" role="columnheader" title="Click to sort by ${label}">${label} ${sortIndicator(key)}</th>`;
  }).join('');
}

export function renderIndexView(archiveData) {
  const container = $('index-table-view');
  if (!container) return;
  _lastArchiveData = archiveData;

  const entries = getFilteredEntries(archiveData);
  const lang = AppState.language;

  const sortedEntries = sortEntries(entries, lang);

  if (sortedEntries.length === 0) {
    container.innerHTML = `
      <div class="index-empty">
        <div class="index-empty-title">${getTranslation('null_set', lang)}</div>
        <div class="index-empty-desc">${getTranslation('null_set_desc', lang)}</div>
      </div>`;
    return;
  }

  const rows = sortedEntries.map((entry, idx) => {
    const brand = entry.tags?.brand
      ? getTranslation(entry.tags.brand, lang)
      : getTranslation('brand_unknown', lang);
    const year = entry.year || '----';
    const season = entry.season || '—';
    const title = entry.title ? getTranslation(entry.title, lang) : '';
    const politics = entry.tags?.politics || '';
    const tagCat = getTagCategory(politics);
    const tagLabel = shortTagLabel(politics);
    const provenance = entry.notes?.provenance
      ? getTranslation(entry.notes.provenance, lang).slice(0, 80) + '…'
      : '—';
    const id = `N-${entry.id.slice(0, 6).toUpperCase()}`;
    const seasonLabel = title ? `${season} · "${title.slice(0, 30)}"` : season;
    const focused = idx === _focusedRowIndex ? 'focused' : '';

    return `
      <tr class="${focused}"
          data-entry-id="${entry.id}"
          data-row-index="${idx}"
          tabindex="0"
          role="link"
          aria-label="Entry ${id}, ${brand}, ${year}, ${tagLabel}">
        <td class="td-id">${id}</td>
        <td class="td-designer">${brand.toUpperCase()}</td>
        <td class="td-year">${year}</td>
        <td class="td-season">${seasonLabel.toUpperCase()}</td>
        <td><span class="td-tag ${tagCat}">${tagLabel.toUpperCase()}</span></td>
        <td class="td-prov">${provenance}</td>
        <td class="td-status">● ARCHIVED</td>
      </tr>`;
  }).join('');

  const total = archiveData.length;
  const filtered = sortedEntries.length;

  container.innerHTML = `
    <div class="index-banner">
      <div class="index-banner-l">
        <span class="index-mode-label">— INDEX</span>
        <span class="index-desc">DENSE TEXTUAL MODE · KEYBOARD NAVIGABLE · SCREEN READER OPTIMISED</span>
      </div>
      <div class="index-shortcuts">
        <span><kbd>↑</kbd><kbd>↓</kbd> NAVIGATE</span>
        <span><kbd>⏎</kbd> OPEN</span>
        <span><kbd>/</kbd> SEARCH</span>
        <span><kbd>?</kbd> HELP</span>
      </div>
    </div>

    <table class="index-table" role="table" aria-label="Archive entries, text-only index view">
      <thead>
        <tr>${buildHeaderRow()}</tr>
      </thead>
      <tbody id="index-table-body">${rows}</tbody>
    </table>

    <div class="index-toolbar">
      <span>SHOWING ${pad(filtered)} OF ${pad(total)}</span>
      <span class="index-shortcuts-inline">
        <kbd>V</kbd> VISUAL · <kbd>I</kbd> INDEX · <kbd>⌘K</kbd> COMMAND · <kbd>?</kbd> HELP
      </span>
    </div>`;

  // Bind row click
  container.querySelectorAll('tbody tr').forEach((tr) => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.entryId;
      if (id) window.location.hash = `detail/${id}/0`;
    });
  });

  // Bind sortable column headers
  container.querySelectorAll('th[data-sort-col]').forEach((th) => {
    const col = th.dataset.sortCol;
    const activate = () => {
      if (_indexSort.col === col) {
        _indexSort.dir = _indexSort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        _indexSort.col = col;
        _indexSort.dir = col === 'year' ? 'desc' : 'asc';
      }
      renderIndexView(_lastArchiveData);
    };
    th.addEventListener('click', activate);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });
}

export function indexNavigateRow(direction) {
  const rows = document.querySelectorAll('#index-table-view tbody tr');
  if (rows.length === 0) return;
  _focusedRowIndex = Math.max(0, Math.min(rows.length - 1, _focusedRowIndex + direction));
  rows.forEach((tr, idx) => {
    tr.classList.toggle('focused', idx === _focusedRowIndex);
    if (idx === _focusedRowIndex) {
      tr.focus();
      tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

export function indexActivateRow() {
  const rows = document.querySelectorAll('#index-table-view tbody tr');
  const tr = rows[_focusedRowIndex];
  if (tr) {
    const id = tr.dataset.entryId;
    if (id) window.location.hash = `detail/${id}/0`;
  }
}

// View mode persistence
const VIEW_MODE_KEY = 'lexicon.view-mode';

export function getViewMode() {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) || 'visual';
  } catch (e) {
    return 'visual';
  }
}

export function setViewMode(mode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch (e) {}
  AppState.viewMode = mode;
  applyViewMode(mode);
}

export function applyViewMode(mode) {
  const gridView = $('grid-view');
  const indexView = $('index-table-view');
  const visualBtn = $('btn-mode-visual');
  const indexBtn = $('btn-mode-index');

  if (mode === 'index') {
    if (gridView) gridView.classList.add('hidden');
    if (indexView) indexView.classList.remove('hidden');
    if (visualBtn) visualBtn.classList.remove('active');
    if (indexBtn) indexBtn.classList.add('active');
  } else {
    if (gridView) gridView.classList.remove('hidden');
    if (indexView) indexView.classList.add('hidden');
    if (visualBtn) visualBtn.classList.add('active');
    if (indexBtn) indexBtn.classList.remove('active');
  }
}
