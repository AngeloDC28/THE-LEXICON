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
let _currentPage = 1;
const PAGE_SIZE = 25;

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

function buildPagination(totalPages) {
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - _currentPage) <= 1) {
      pages.push(`<button class="idx-page-btn${p === _currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }
  return `<div class="idx-pagination">
    <button class="idx-page-btn" data-page="${_currentPage - 1}" ${_currentPage <= 1 ? 'disabled' : ''}>PREV</button>
    ${pages.join('')}
    <button class="idx-page-btn" data-page="${_currentPage + 1}" ${_currentPage >= totalPages ? 'disabled' : ''}>NEXT</button>
  </div>`;
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
    return `<th scope="col"${w} class="sortable${active}" data-sort-col="${key}" aria-sort="${ariaSort}" tabindex="0" role="columnheader" aria-label="Sort by ${label}">${label} ${sortIndicator(key)}</th>`;
  }).join('');
}

function csvEscape(val) {
  const s = String(val ?? '').replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function exportCsv(entries, lang) {
  const headers = ['ID', 'BRAND', 'YEAR', 'SEASON', 'ANALYTICAL_TAG', 'PROVENANCE'];
  const rows = entries.map(e => [
    `N-${e.id.slice(0, 6).toUpperCase()}`,
    e.tags?.brand || '',
    e.year || '',
    e.season || '',
    e.tags?.politics || '',
    (e.notes?.provenance || '').slice(0, 120),
  ].map(csvEscape).join(','));
  const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'lexicon-export.csv' }).click();
  URL.revokeObjectURL(url);
}

function exportBibtex(entries, lang) {
  const bib = entries.map(e => {
    const key = `${(e.tags?.brand || 'Unknown').replace(/\s+/g, '')}_${e.year || '0000'}`;
    const brand = e.tags?.brand || 'Unknown';
    const year = e.year || '';
    const season = e.season || '';
    const politics = e.tags?.politics || '';
    return `@misc{${key},\n  author = {${brand}},\n  title = {${season} Collection${politics ? ' — ' + politics : ''}},\n  year = {${year}},\n  howpublished = {THE LEXICON Archive}\n}`;
  }).join('\n\n');
  const blob = new Blob([bib], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'lexicon-export.bib' }).click();
  URL.revokeObjectURL(url);
}

export function renderIndexView(archiveData, resetPage = false) {
  const container = $('index-table-view');
  if (!container) return;
  _lastArchiveData = archiveData;
  if (resetPage) _currentPage = 1;

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

  // Paginate
  const totalFiltered = sortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  _currentPage = Math.min(_currentPage, totalPages);
  const pageStart = (_currentPage - 1) * PAGE_SIZE;
  const pageEntries = sortedEntries.slice(pageStart, pageStart + PAGE_SIZE);

  const rows = pageEntries.map((entry, idx) => {
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

    // STATUS: hotspot count + note completeness
    const hotspotCount = (entry.images || []).reduce((sum, img) => sum + (img?.hotspots?.length || 0), 0);
    const noteCount = ['provenance', 'critique', 'strategy'].filter(k => entry.notes?.[k]).length;
    const statusParts = [];
    if (hotspotCount > 0) statusParts.push(`◉ ${hotspotCount}`);
    if (noteCount === 3) statusParts.push('✦ FULL');
    else if (noteCount > 0) statusParts.push(`${noteCount}/3 NOTES`);
    const statusClass = hotspotCount > 0 ? 'td-status cited' : 'td-status';
    const statusText = statusParts.length ? statusParts.join(' · ') : '● ARCHIVED';

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
        <td class="${statusClass}">${statusText}</td>
      </tr>`;
  }).join('');

  const total = archiveData.length;
  const filtered = totalFiltered;

  // Build active filter chips for index view header
  const activeFilterChips = Object.entries(AppState.filters)
    .filter(([, v]) => v)
    .flatMap(([key, val]) =>
      val.split('|').map(v => v.trim()).filter(Boolean).map(v => {
        // Shorten long politics tag values to category label
        const displayVal = key === 'politics' ? shortTagLabel(v).toUpperCase() : v.toUpperCase();
        return `<span class="idx-filter-chip" data-type="${key}" data-val="${v}">${key.toUpperCase()}: ${displayVal} ×</span>`;
      })
    ).join('');
  const searchChip = AppState.searchQuery
    ? `<span class="idx-filter-chip" data-type="search" data-val="">${AppState.searchQuery} ×</span>`
    : '';
  const filterBar = (activeFilterChips || searchChip)
    ? `<div class="index-filter-bar">${searchChip}${activeFilterChips}</div>`
    : '';

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
    ${filterBar}

    <table class="index-table" role="table" aria-label="Archive entries, text-only index view">
      <thead>
        <tr>${buildHeaderRow()}</tr>
      </thead>
      <tbody id="index-table-body">${rows}</tbody>
    </table>

    <div class="index-toolbar">
      <span class="index-showing">SHOWING ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered)} OF ${filtered} FILTERED / ${total} TOTAL</span>
      ${totalPages > 1 ? buildPagination(totalPages) : ''}
      <span class="index-export">
        <button class="idx-export-btn" data-export="csv">EXPORT CSV</button>
        <span class="opacity-30">·</span>
        <button class="idx-export-btn" data-export="bibtex">BIBTEX</button>
      </span>
    </div>
    <div class="index-kbd-bar">
      <span><kbd>V</kbd> VISUAL</span>
      <span>·</span>
      <span><kbd>I</kbd> INDEX</span>
      <span>·</span>
      <span><kbd>/</kbd> SEARCH</span>
      <span>·</span>
      <span><kbd>⌘K</kbd> COMMAND</span>
      <span>·</span>
      <span><kbd>J/K</kbd> NAVIGATE</span>
      <span>·</span>
      <span><kbd>⏎</kbd> OPEN</span>
      <span>·</span>
      <span><kbd>S</kbd> SAVE</span>
      <span>·</span>
      <span><kbd>C</kbd> CITE</span>
      <span>·</span>
      <span><kbd>N</kbd> NEXUS</span>
      <span>·</span>
      <span><kbd>?</kbd> HELP</span>
    </div>`;

  // Bind row click
  container.querySelectorAll('tbody tr').forEach((tr) => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.entryId;
      if (id) window.location.hash = `detail/${id}/0`;
    });
  });

  // Bind index filter chip dismissal
  container.querySelectorAll('.idx-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.type;
      if (type === 'search') {
        AppState.searchQuery = '';
        const si = document.getElementById('search-input');
        if (si) si.value = '';
      } else {
        const removedVal = chip.dataset.val;
        const current = AppState.filters[type] || '';
        const remaining = current.split('|').map(s => s.trim()).filter(v => v && v !== removedVal);
        AppState.filters[type] = remaining.length ? remaining.join('|') : null;
      }
      renderIndexView(_lastArchiveData);
      document.dispatchEvent(new CustomEvent('lexicon-refresh'));
    });
  });

  // Bind pagination
  container.querySelectorAll('.idx-page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (!isNaN(p) && p >= 1 && p <= totalPages && p !== _currentPage) {
        _currentPage = p;
        _focusedRowIndex = 0;
        renderIndexView(_lastArchiveData);
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Bind export buttons
  container.querySelectorAll('.idx-export-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.export === 'csv') exportCsv(sortedEntries, lang);
      else if (btn.dataset.export === 'bibtex') exportBibtex(sortedEntries, lang);
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
