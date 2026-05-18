/**
 * app.js
 * Entry point for THE LEXICON.
 * Orchestrates module initialization and global event delegation.
 */

import { archiveData } from '../database.js';
import { imageDimensions } from './modules/image-dimensions.js';
import { $, $$, debounce, initCustomCursor, showToast, resolveImgSrc, setImageDimensions, webpSrc } from './modules/core-utils.js';
setImageDimensions(imageDimensions);
import { AppState, updateHash, emptyFilters } from './modules/core-state.js';
import { renderTaxonomyGrid, renderTaxonomySub, getFilteredEntries, setActiveTaxonomy } from './modules/search-engine.js';
import { renderImageGrid, renderEntryList } from './modules/render-grid.js';
import { openDetail, closeDetail, navigateEntry, updateStatusBar } from './modules/render-detail.js';
import { initHotspotInteractions, cleanupHotspots, toggleMobileHotspots } from './modules/hotspots.js';
// sticky-notes module reserved for future use; previous exports were dead.
import { switchView } from './modules/navigation.js';
import { openConnectionMatrix, closeConnectionMatrix } from './modules/connection-matrix.js';
import { initHeaderTypewriter, updateHeaderTelemetry } from './modules/telemetry.js';
import { initFirebaseAuth, toggleAuth, sendSignInLink, createArchivalFolder, saveToFolder, currentUser, fetchArchivalFolders } from './modules/auth.js';
import { addRecentlyViewed, toggleBookmark, isBookmarked } from './modules/storage.js';
import { toggleCmdPalette, handleCmdKeydown, renderCmdResults } from './modules/command-palette.js';
import { renderTimeline, renderFilterChips, updateMetaForEntry, resetMeta, extractAccentColor } from './modules/ui-extras.js';
import { getTranslation, supportedLanguages } from './modules/translations.js';

// --- Shared Callbacks ---
const callbacks = {
  openDetail: (id, idx = 0) => openDetail(id, idx, archiveData, callbacks),
  closeDetail: () => closeDetail(callbacks, archiveData),
  navigateEntry: (dir) => navigateEntry(dir, archiveData, callbacks),
  showToast: showToast,
  renderFolders: () => renderFoldersView(),
  renderFolderOptions: () => renderSaveFolderModal(),
  updateBookmarkUI: (id) => {
    const btn = $('btn-bookmark-entry');
    if (btn) { btn.style.opacity = isBookmarked(id) ? '1' : '0.4'; }
  },
  closeModal: (id) => {
    const modal = $(id + '-modal');
    if (modal) modal.classList.add('hidden');
  },
  updateHeaderTelemetry: updateHeaderTelemetry,
  addRecentlyViewed: (id) => addRecentlyViewed(id, archiveData, callbacks),
  updateMetaForEntry: updateMetaForEntry,
  extractAccentColor: extractAccentColor,
  resetMeta: resetMeta,
  switchView: (view) => switchView(view, callbacks),
  onUpdate: () => refreshUI()
};

// --- Initialization ---
window.addEventListener('hashchange', handleRouting);
document.addEventListener('DOMContentLoaded', () => {
  // FIX-5: Bind UI events immediately so buttons work even if init throws
  setupEventListeners();
  try {
  if (!archiveData || archiveData.length === 0) return;

  // Initial State
  AppState.archivalFolders = fetchArchivalFolders();

  // Systems
  initCustomCursor();
  initHeaderTypewriter();
  // Pass archiveData to hotspots so it doesn't need to import database.js itself
  initHotspotInteractions(archiveData);
  initFirebaseAuth(callbacks);

  // Listeners
  // setupEventListeners() already called at top of DOMContentLoaded (FIX-5)
  handleRouting();

  // Initial Render
  refreshUI();

  // Orientation Panel Logic
  var dismissed;
  try { dismissed = localStorage.getItem('lexicon-orientation-dismissed'); } catch(e) {}
  if (dismissed) {
    const op = $('orientation-panel');
    if (op) op.classList.add('hidden');
  }

  // Reveal UI
  setTimeout(() => {
    const overlay = $('boot-overlay');
    const root = $('app-root');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.classList.add('hidden');
        if (root) root.classList.remove('opacity-0');
      }, 300);
    } else if (root) {
      root.classList.remove('opacity-0');
    }
  }, 500);
    } catch(e) { console.error('LEXICON_BOOT_ERROR:', e); }
});

function refreshUI() {
  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);
  syncHashFromState();

  // --- Header ---
  const btnAuth = $('btn-auth-toggle');
  const btnAuthMobile = $('btn-auth-toggle-mobile');
  const authText = currentUser ? t('nav_signout') : t('nav_signin');
  if (btnAuth) btnAuth.textContent = authText.toUpperCase();
  if (btnAuthMobile) btnAuthMobile.textContent = authText.toUpperCase();

  const btnAbout = $('btn-about');
  const btnAboutMobile = $('btn-about-mobile');
  if (btnAbout) btnAbout.textContent = t('nav_about').toUpperCase();
  if (btnAboutMobile) btnAboutMobile.textContent = t('nav_about_mobile').toUpperCase();

  const btnContact = $('btn-contact');
  const btnContactMobile = $('btn-contact-mobile');
  if (btnContact) btnContact.textContent = t('nav_contact').toUpperCase();
  if (btnContactMobile) btnContactMobile.textContent = t('nav_contact_mobile').toUpperCase();

  const btnLangLabel = $('btn-lang-toggle-label');
  const btnLangMobile = $('btn-lang-toggle-mobile');
  if (btnLangLabel) btnLangLabel.textContent = (t('nav_language') + ': ' + lang.toUpperCase()).toUpperCase();
  if (btnLangMobile) btnLangMobile.textContent = (t('nav_language') + ': ' + lang.toUpperCase()).toUpperCase();
  renderLangDropdown();

  const btnTheme = $('btn-theme-toggle');
  const btnThemeMobile = $('btn-theme-toggle-mobile');
  const isDark = document.documentElement.classList.contains('dark');
  const themeText = isDark ? t('nav_theme_dark') : t('nav_theme_light');
  if (btnTheme) btnTheme.textContent = themeText.toUpperCase();
  if (btnThemeMobile) btnThemeMobile.textContent = t('nav_theme_mobile').toUpperCase();

  const btnFoldersMobile = $('btn-folders-toggle-mobile');
  if (btnFoldersMobile) btnFoldersMobile.textContent = t('nav_folders_mobile').toUpperCase();

  const telemetry = $('telemetry-text');
  if (telemetry) telemetry.textContent = t('telemetry_status');

  // --- Index Panel ---
  const indexTitle = $('index-panel-title');
  if (indexTitle) indexTitle.textContent = t('index_title');

  const btnBookmarks = $('btn-show-bookmarks');
  if (btnBookmarks) btnBookmarks.textContent = t('index_saved');

  const recentTitle = $$('#recent-container span')[0];
  if (recentTitle) recentTitle.textContent = t('index_recent');

  const searchInput = $('search-input');
  if (searchInput) searchInput.placeholder = t('search_placeholder');

  const btnClearDir = $('btn-clear-directory');
  if (btnClearDir) btnClearDir.textContent = t('search_clear');

  // --- Status Ribbon ---
  const statusLabels = {
    'status-brand': 'status_brand',
    'status-year':  'status_year',
    'status-season':'status_season',
    'status-entry': 'status_entry'
  };
  Object.entries(statusLabels).forEach(([id, key]) => {
    const el = $(id)?.previousElementSibling;
    if (el) el.textContent = t(key);
  });

  // --- View switcher ---
  const btnGrid     = $('btn-toggle-grid');
  const btnTimeline = $('btn-toggle-timeline');
  if (btnGrid)     btnGrid.textContent     = t('label_grid_view');
  if (btnTimeline) btnTimeline.textContent = t('label_timeline');

  // --- Orientation panel ---
  const oriTitle = $$('#orientation-panel h2')[0];
  if (oriTitle) oriTitle.textContent = t('orientation_title');
  const oriDesc = $$('#orientation-panel > div > p')[0];
  if (oriDesc) oriDesc.textContent = t('orientation_desc');
  const oriHeadings = $$('#orientation-panel h3');
  const oriParas    = $$('#orientation-panel .grid p');
  const oriKeys = [
    ['orientation_col1_title','orientation_col1_desc'],
    ['orientation_col2_title','orientation_col2_desc'],
    ['orientation_col3_title','orientation_col3_desc']
  ];
  oriKeys.forEach(([hKey, pKey], i) => {
    if (oriHeadings[i]) oriHeadings[i].textContent = t(hKey);
    if (oriParas[i])    oriParas[i].textContent    = t(pKey);
  });
  const btnDismissOri = $('btn-dismiss-orientation');
  if (btnDismissOri) btnDismissOri.textContent = t('orientation_proceed');

  // --- Active Entry Detail ---
  const btnSaveFolder       = $('btn-save-to-folder');
  const btnSaveFolderMobile = $('btn-save-folder-mobile');
  if (btnSaveFolder)       btnSaveFolder.textContent       = t('btn_save_folder');
  if (btnSaveFolderMobile) btnSaveFolderMobile.textContent = t('btn_save_folder');

  const btnNexus = $('btn-open-matrix');
  if (btnNexus) btnNexus.textContent = t('btn_view_nexus');

  const btnCopyLink = $('btn-copy-link');
  if (btnCopyLink) btnCopyLink.textContent = t('btn_copy_link');

  const btnCite = $('btn-cite-entry');
  if (btnCite) btnCite.textContent = t('btn_cite_entry');
  const citeTitle = $('cite-modal-title');
  if (citeTitle) citeTitle.textContent = t('cite_modal_title');
  const citeSub = $$('#cite-modal h2 + p')[0];
  if (citeSub) citeSub.textContent = t('cite_modal_subtitle');
  const citeLabels = $$('#cite-modal .text-\\[10px\\].font-bold');
  if (citeLabels.length >= 3) {
    citeLabels[0].textContent = t('cite_chicago_label');
    citeLabels[1].textContent = t('cite_bibtex_label');
    citeLabels[2].textContent = t('cite_url_label');
  }
  document.querySelectorAll('.cite-copy-btn').forEach(b => {
    if (!b.classList.contains('btn-copied')) b.textContent = t('cite_copy');
  });

  const btnBackGrid = $('btn-back-grid');
  if (btnBackGrid) btnBackGrid.textContent = t('btn_back_grid');

  const btnFullscreen = $('btn-fullscreen-toggle');
  if (btnFullscreen) btnFullscreen.textContent = '[ ' + t('btn_fullscreen') + ' ]';

  const payloadLabel = $$('#analytical-payload .node-label')[0];
  if (payloadLabel) payloadLabel.textContent = '[ ' + t('label_analysis') + ' ]';

  // --- Mobile detail actions ---
  const btnHotspotsMobile = $('btn-toggle-hotspots-mobile');
  if (btnHotspotsMobile) btnHotspotsMobile.textContent = t('btn_hotspots_mobile');

  // --- Technical specs label ---
  const techSpecsLabel = $$('#detail-metadata-sidebar h4')[0];
  if (techSpecsLabel) techSpecsLabel.textContent = t('tech_specs');

  // --- Related entries label ---
  const relatedLabel = $('related-entries-title');
  if (relatedLabel) relatedLabel.textContent = t('related_artifacts');

  // --- Mobile drawer search button ---
  const btnSearchMobile = $('btn-search-mobile');
  if (btnSearchMobile) btnSearchMobile.textContent = t('btn_search_mobile');


  // --- Folders View ---
  const folderTitle = $$('#folders-view h1')[0];
  if (folderTitle) folderTitle.textContent = t('folders_title');

  const btnExport = $('btn-export-all-folders');
  if (btnExport) btnExport.textContent = t('folders_export');

  const folderCount = $('folders-count');
  if (folderCount) folderCount.textContent = `${AppState.archivalFolders.length} ${t('folders_initialized')}`;

  const btnClearFolderFilter = $('btn-clear-folder-filter');
  if (btnClearFolderFilter) btnClearFolderFilter.textContent = t('btn_clear_filter');

  // --- Modals ---
  const bootText = $('boot-text');
  if (bootText) bootText.textContent = t('loading');

  const cookieText = $('cookie-notice-text');
  if (cookieText) cookieText.textContent = t('cookie_notice');

  const btnAcceptCookies = $('btn-accept-cookies');
  if (btnAcceptCookies) btnAcceptCookies.textContent = t('accept_terms');

  // Auth Modal
  const authTitle = $$('#auth-modal h2')[0];
  if (authTitle) authTitle.textContent = t('modal_terminal_access');

  const authDesc = $$('#auth-form-container p')[0];
  if (authDesc) authDesc.textContent = t('modal_auth_desc');

  const btnSubmitAuth = $('btn-submit-auth');
  if (btnSubmitAuth) btnSubmitAuth.textContent = t('modal_auth_transmit');

  // Save to Folder Modal
  const saveFolderTitle = $$('#save-folder-modal h2')[0];
  if (saveFolderTitle) saveFolderTitle.textContent = t('btn_save_folder');

  const newFolderLabel = $$('#save-folder-modal label')[0];
  if (newFolderLabel) newFolderLabel.textContent = t('btn_initialize').replace('[ ', '').replace(' ]', '');

  const btnInitialize = $('btn-create-folder');
  if (btnInitialize) btnInitialize.textContent = t('btn_initialize');

  // About Modal
  const aboutTitle = $('about-modal-title');
  if (aboutTitle) aboutTitle.textContent = t('modal_about_title');

  const aboutBody = $('about-modal-body');
  if (aboutBody) {
    aboutBody.innerHTML = t('modal_about_body').map(p => `<p>${p}</p>`).join('');
  }

  // Contact Modal
  const contactTitle = $('contact-modal-title');
  if (contactTitle) contactTitle.textContent = t('modal_contact_title');

  const contactBody = $('contact-modal-body');
  if (contactBody) {
    contactBody.innerHTML = t('modal_contact_body').map(p => `<p>${p}</p>`).join('');
  }

  // Legal Modals
  const privacyTitle = $('privacy-modal-title');
  if (privacyTitle) privacyTitle.textContent = t('legal_privacy_title');

  const privacyBody = $('privacy-modal-body');
  if (privacyBody) {
    privacyBody.innerHTML = t('legal_privacy_body').map(p => `<p>${p}</p>`).join('');
  }

  const termsTitle = $('terms-modal-title');
  if (termsTitle) termsTitle.textContent = t('legal_terms_title');

  const termsBody = $('terms-modal-body');
  if (termsBody) {
    termsBody.innerHTML = t('legal_terms_body').map(p => `<p>${p}</p>`).join('');
  }

  // --- Sort Button ---
  const sortBtn = $('btn-sort-cycle');
  if (sortBtn) {
    const sortLabels = {
      'default':   t('sort_default'),
      'year-asc':  t('sort_year_asc'),
      'year-desc': t('sort_year_desc'),
      'brand-az':  t('sort_brand_az')
    };
    const currentSortLabel = sortLabels[AppState.sortMode || 'default'] || t('sort_default');
    sortBtn.textContent = `${t('sort_label')}: ${currentSortLabel}`;
  }

  // --- Taxonomy ---
  const taxHeading = $('taxonomy-heading');
  if (taxHeading) taxHeading.textContent = t('taxonomy_heading') || 'Taxonomy';
  renderTaxonomyGrid();
  renderTaxonomySub(callbacks);

  // --- Rendering ---
  const filtered = getFilteredEntries(archiveData);

  // Persistent Sidebar
  renderEntryList(archiveData, callbacks);

  if (AppState.currentView === 'grid') {
    renderImageGrid(archiveData, callbacks);
  } else if (AppState.currentView === 'timeline') {
    renderTimeline(filtered, callbacks);
  } else if (AppState.currentView === 'folders') {
    if (callbacks.renderFolders) callbacks.renderFolders();
  }

  renderFilterChips(callbacks);
  updateStatusBar(archiveData);
}

let _suppressHashSync = false;

function applyStateFromQuery(params) {
  if (params.has('sort')) AppState.sortMode = params.get('sort');
  if (params.has('q')) {
    AppState.searchQuery = params.get('q');
    const si = $('search-input');
    if (si) si.value = AppState.searchQuery;
  }
  for (const key of Object.keys(AppState.filters)) {
    if (params.has(key)) AppState.filters[key] = params.get(key);
  }
}

export function syncHashFromState() {
  if (_suppressHashSync) return;
  // Detail view manages its own hash; don't overwrite it here.
  if (AppState.selectedEntryId) return;
  const params = new URLSearchParams();
  if (AppState.sortMode && AppState.sortMode !== 'default') params.set('sort', AppState.sortMode);
  if (AppState.searchQuery) params.set('q', AppState.searchQuery);
  for (const [k, v] of Object.entries(AppState.filters)) {
    if (v) params.set(k, v);
  }
  const view = AppState.currentView || 'grid';
  const qs = params.toString();
  const newHash = '#' + view + (qs ? '?' + qs : '');
  if (window.location.hash === newHash || (view === 'grid' && !qs && !window.location.hash)) return;
  _suppressHashSync = true;
  history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
  setTimeout(() => { _suppressHashSync = false; }, 0);
}

function handleRouting() {
  if (_suppressHashSync) return;
  const raw = window.location.hash.slice(1); // strip #
  if (!raw) { switchView('grid', callbacks); return; }

  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');

  if (path.startsWith('detail/')) {
    const parts = path.replace('detail/', '').split('/');
    const id  = parts[0];
    const idx = parts[1] ? parseInt(parts[1]) : 0;
    openDetail(id, idx, archiveData, callbacks);
    return;
  }

  // Apply persisted filters/sort/search BEFORE switching view
  applyStateFromQuery(params);

  if (path === 'folders')   { switchView('folders', callbacks); return; }
  if (path === 'timeline')  { switchView('timeline', callbacks); return; }
  if (path === 'grid' || path === '') { switchView('grid', callbacks); return; }

  // Fallback: maybe it's a bare entry id
  const entry = archiveData.find(e => e.id === path);
  if (entry) {
    openDetail(path, 0, archiveData, callbacks);
  } else {
    switchView('grid', callbacks);
  }
}

function setupEventListeners() {
  // Global Click Delegation
  document.addEventListener('click', (e) => {

    // Grid Cell Click
    const gridCell = e.target.closest('.grid-cell');
    if (gridCell) {
      const id  = gridCell.dataset.entryId;
      const idx = gridCell.dataset.imgIndex || 0;
      window.location.hash = `detail/${id}/${idx}`;
      return;
    }

    // Entry Item Click (A-Z Index)
    const entryItem = e.target.closest('.entry-item');
    if (entryItem) {
      const id = entryItem.dataset.id;
      window.location.hash = `detail/${id}/0`;
      return;
    }

    // Recent Entry Click
    const recentItem = e.target.closest('[data-recent-id]');
    if (recentItem) {
      openDetail(recentItem.dataset.recentId, 0, archiveData, callbacks);
      return;
    }

    // ── Taxonomy Navigation ──────────────────────────────────────
    // Scope to the taxonomy section so unrelated buttons elsewhere with
    // overlapping data-attributes (filter chips, metadata tags, etc.)
    // don't accidentally toggle the filter panel.
    const inTaxonomy = e.target.closest('#taxonomy-grid, #taxonomy-sub');

    // Tier 1: category type button (has data-taxonomy-type but NOT data-taxonomy-val)
    const taxType = inTaxonomy ? e.target.closest('[data-taxonomy-type]') : null;
    if (taxType && !taxType.dataset.taxonomyVal) {
      const type = taxType.dataset.taxonomyType;
      setActiveTaxonomy(type);
      renderTaxonomyGrid();
      renderTaxonomySub(callbacks);
      return;
    }

    // Tier 2: value button (has both data-taxonomy-type and data-taxonomy-val)
    // Allow these from anywhere — chips outside the taxonomy section
    // (e.g., metadata-tag-btn on detail view) should still apply filters.
    const taxVal = e.target.closest('[data-taxonomy-val]');
    if (taxVal) {
      const type = taxVal.dataset.taxonomyType;
      const val  = taxVal.dataset.taxonomyVal;
      // Toggle: clicking the active value deselects it
      AppState.filters[type] = AppState.filters[type] === val ? null : val;
      AppState.activeTaxonomy = null;
      refreshUI();
      updateHash('grid');
      return;
    }

    // Back button inside taxonomy sub-panel
    if (e.target.closest('[data-taxonomy-back]') || e.target.id === 'btn-taxonomy-back') {
      AppState.activeTaxonomy = null;
      renderTaxonomyGrid();
      renderTaxonomySub(callbacks);
      return;
    }
    // ────────────────────────────────────────────────────────────

  });

  // Header Title
  $('header-title')?.addEventListener('click', () => {
    AppState.filters = emptyFilters();
    AppState.searchQuery = '';
    AppState.activeFolderId = null;
    if ($('search-input')) $('search-input').value = '';
    switchView('grid', callbacks);
    refreshUI();
    updateHash('grid');
  });

  // Toggles
  $('btn-folders-toggle')?.addEventListener('click', () => switchView('folders', callbacks));
  $('btn-folders-toggle-mobile')?.addEventListener('click', () => { switchView('folders', callbacks); toggleHamburger(); });
  $('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  $('btn-lang-toggle')?.addEventListener('click', toggleLangDropdown);
  document.addEventListener('click', (e) => {
    const dd = $('lang-dropdown');
    if (!dd || dd.classList.contains('hidden')) return;
    if (!e.target.closest('#lang-dropdown') && !e.target.closest('#btn-lang-toggle')) {
      dd.classList.add('hidden');
      $('btn-lang-toggle')?.setAttribute('aria-expanded', 'false');
    }
  });
  $('btn-auth-toggle')?.addEventListener('click', () => { toggleAuth(); setTimeout(() => $('auth-email')?.focus(), 50); });
  $('btn-theme-toggle-mobile')?.addEventListener('click', toggleTheme);
  $('btn-lang-toggle-mobile')?.addEventListener('click', toggleLanguage);
  $('btn-auth-toggle-mobile')?.addEventListener('click', () => { toggleAuth(); setTimeout(() => $('auth-email')?.focus(), 50); });

  // Modals
  $('btn-about')?.addEventListener('click', () => $('about-modal').classList.remove('hidden'));
  $('btn-contact')?.addEventListener('click', () => $('contact-modal').classList.remove('hidden'));
  $('btn-about-mobile')?.addEventListener('click', () => { $('about-modal').classList.remove('hidden'); toggleHamburger(); });
  $('btn-contact-mobile')?.addEventListener('click', () => { $('contact-modal').classList.remove('hidden'); toggleHamburger(); });
  $('btn-search-mobile')?.addEventListener('click', () => { const s = $('search-input'); if (s) { s.focus(); s.scrollIntoView({ behavior: 'smooth' }); } });
  $('btn-privacy-link')?.addEventListener('click', () => $('privacy-modal').classList.remove('hidden'));
  $('btn-terms-link')?.addEventListener('click', () => $('terms-modal').classList.remove('hidden'));

  // Auth form
  $('auth-form')?.addEventListener('submit', (e) => { e.preventDefault(); sendSignInLink(callbacks); });

  // Create folder
  const createFolder = () => { const name = $('new-folder-name')?.value?.trim(); if (name) createArchivalFolder(name, callbacks); };
  $('btn-create-folder')?.addEventListener('click', createFolder);
  $('new-folder-name')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); createFolder(); } });

  $('btn-hamburger')?.addEventListener('click', toggleHamburger);
  $('drawer-backdrop')?.addEventListener('click', toggleHamburger);

  document.querySelectorAll('[data-modal-backdrop]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-modal-backdrop');
      $(modalId + '-modal').classList.add('hidden');
    });
  });
  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-modal-close');
      $(modalId + '-modal').classList.add('hidden');
    });
  });

  // Search
  $('search-input')?.addEventListener('input', debounce((e) => {
    AppState.searchQuery = e.target.value;
    refreshUI();
  }, 300));

  $('btn-clear-directory')?.addEventListener('click', () => {
    AppState.filters = emptyFilters();
    AppState.searchQuery = '';
    AppState.activeFolderId = null;
    if ($('search-input')) $('search-input').value = '';
    refreshUI();
  });

  $('btn-clear-folder-filter')?.addEventListener('click', () => {
    AppState.activeFolderId = null;
    refreshUI();
  });

  // --- Orientation ---
  const dismissOrientation = () => {
    const op = $('orientation-panel');
    if (op) op.classList.add('hidden');
    try { localStorage.setItem('lexicon-orientation-dismissed', 'true'); } catch(e) {}
  };
  $('btn-dismiss-orientation')?.addEventListener('click', dismissOrientation);
  $('btn-close-orientation')?.addEventListener('click', dismissOrientation);

  // --- View Toggles ---
  $('btn-toggle-grid')?.addEventListener('click', () => switchView('grid', callbacks));
  $('btn-toggle-timeline')?.addEventListener('click', () => switchView('timeline', callbacks));

  // Sort cycle
  $('btn-sort-cycle')?.addEventListener('click', () => {
    const modes = ['default', 'year-asc', 'year-desc', 'brand-az'];
    const idx = modes.indexOf(AppState.sortMode || 'default');
    AppState.sortMode = modes[(idx + 1) % modes.length];
    refreshUI();
  });

  // Detail
  $('btn-back-grid')?.addEventListener('click', () => closeDetail(callbacks, archiveData));
  $('btn-back-grid-mobile')?.addEventListener('click', () => closeDetail(callbacks, archiveData));
  $('btn-toggle-hotspots-mobile')?.addEventListener('click', toggleMobileHotspots);
  $('btn-nexus-mobile')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) openConnectionMatrix(AppState.selectedEntryId, archiveData, callbacks);
  });
  $('btn-related-open-nexus')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) openConnectionMatrix(AppState.selectedEntryId, archiveData, callbacks);
  });
  $('btn-notes-mobile')?.addEventListener('click', () => openMobileNotes());
  $('btn-close-mobile-notes')?.addEventListener('click', () => $('mobile-notes-sheet')?.classList.add('hidden'));
  document.querySelectorAll('.mobile-note-tab').forEach(tab => {
    tab.addEventListener('click', () => showMobileNote(tab.dataset.mobileNote));
  });
  $('btn-viewer-prev')?.addEventListener('click', () => navigateEntry(-1, archiveData, callbacks));
  $('btn-viewer-next')?.addEventListener('click', () => navigateEntry(1, archiveData, callbacks));

  $('btn-bookmark-entry')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) toggleBookmark(AppState.selectedEntryId, callbacks);
  });

  $('btn-copy-link')?.addEventListener('click', () => {
    const lang = AppState.language;
    const btn = $('btn-copy-link');
    const url = `${window.location.origin}${window.location.pathname}#detail/${AppState.selectedEntryId}/${AppState.currentImageIndex}`;
    const flashCopied = () => {
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = '✓ ' + getTranslation('link_copied', lang).replace('.','').toUpperCase();
      btn.classList.add('btn-copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('btn-copied');
      }, 1500);
    };
    navigator.clipboard?.writeText(url).then(flashCopied).catch(() => {
      showToast(url);
    });
  });

  $('btn-cmd-palette-hint')?.addEventListener('click', () => toggleCmdPalette(archiveData, callbacks));

  // Cite Entry modal: build BibTeX + Chicago + permalink for the active entry
  $('btn-cite-entry')?.addEventListener('click', () => openCiteModal());
  document.querySelectorAll('.cite-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.citeCopy;
      const el = $('cite-' + which);
      if (!el) return;
      navigator.clipboard?.writeText(el.textContent).then(() => {
        const original = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('btn-copied');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('btn-copied'); }, 1400);
      });
    });
  });

  // Lightbox: click the detail image to open zoomable fullscreen view
  $('detail-image')?.addEventListener('click', () => openLightbox());
  $('btn-close-lightbox')?.addEventListener('click', () => closeLightbox());
  $('btn-lightbox-prev')?.addEventListener('click', () => navigateLightbox(-1));
  $('btn-lightbox-next')?.addEventListener('click', () => navigateLightbox(1));
  $('lightbox-stage')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightbox-stage') { closeLightbox(); return; }
    toggleLightboxZoom(e);
  });

  // Click-to-filter from detail metadata grid: tap any tag → filter archive
  $('metadata-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.metadata-tag-btn');
    if (!btn) return;
    const type  = btn.dataset.taxType;
    const value = btn.dataset.taxValue;
    if (!type || !value) return;
    // Reset other filters, set this one
    Object.keys(AppState.filters).forEach(k => AppState.filters[k] = null);
    AppState.filters[type] = value;
    closeDetail(callbacks, archiveData);
    switchView('grid', callbacks);
    refreshUI();
    showToast(getTranslation('filtering_label', AppState.language) + ' ' + value);
  });

  $('btn-open-matrix')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) openConnectionMatrix(AppState.selectedEntryId, archiveData, callbacks);
  });
  $('btn-close-matrix')?.addEventListener('click', () => closeConnectionMatrix());
  $('matrix-backdrop')?.addEventListener('click', () => closeConnectionMatrix());

  $('btn-save-to-folder')?.addEventListener('click', () => {
    if (!currentUser) { showToast(getTranslation('auth_required', AppState.language)); toggleAuth(); return; }
    $('save-folder-modal').classList.remove('hidden');
    renderSaveFolderModal();
  });
  $('btn-save-folder-mobile')?.addEventListener('click', () => {
    if (!currentUser) { showToast(getTranslation('auth_required', AppState.language)); toggleAuth(); return; }
    $('save-folder-modal').classList.remove('hidden');
    renderSaveFolderModal();
  });

  $('btn-export-all-folders')?.addEventListener('click', () => exportAllFolders());

  // Hotspot interaction is now handled in render-detail.js per-render.


  // Keyboard
  window.addEventListener('keydown', (e) => {
    // Lightbox takes priority — Esc closes it, arrows navigate inside it
    const lightbox = $('image-lightbox');
    if (lightbox && !lightbox.classList.contains('hidden')) {
      if (e.key === 'Escape')     { e.preventDefault(); closeLightbox(); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateLightbox(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateLightbox(1); return; }
    }
    // Generic: Escape closes any open dialog-style modal
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-backdrop:not(.hidden), [role="dialog"]:not(.hidden)');
      if (openModal && openModal.id !== 'image-lightbox') {
        openModal.classList.add('hidden');
        e.preventDefault();
        return;
      }
    }
    // Don't swallow typing in form fields
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    if (AppState.selectedEntryId) {
      if (e.key === 'ArrowLeft')       { e.preventDefault(); navigateEntry(-1, archiveData, callbacks); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateEntry(1, archiveData, callbacks); }
      else if (e.key === 'Escape')     closeDetail(callbacks, archiveData);
    }
    // Grid cell keyboard activation
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.classList.contains('grid-cell')) {
      e.preventDefault();
      const id  = document.activeElement.dataset.entryId;
      const idx = document.activeElement.dataset.imgIndex || 0;
      if (id) window.location.hash = `detail/${id}/${idx}`;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCmdPalette(archiveData, callbacks);
    }
    handleCmdKeydown(e, archiveData, callbacks);
  });

  $('cmd-input')?.addEventListener('input', (e) => {
    renderCmdResults(e.target.value, archiveData, callbacks);
  });
  $('cmd-palette-backdrop')?.addEventListener('click', () => toggleCmdPalette(archiveData, callbacks));

  // Cookie
  var cookieAccepted;
  try { cookieAccepted = localStorage.getItem('lexicon-terms-accepted'); } catch(e) {}
  if (!cookieAccepted) {
    $('cookie-banner')?.classList.remove('hidden');
  }
  $('btn-accept-cookies')?.addEventListener('click', () => {
    try { localStorage.setItem('lexicon-terms-accepted', 'true'); } catch(e) {}
    $('cookie-banner')?.classList.add('hidden');
  });

  // Custom Refresh Event
  document.addEventListener('lexicon-refresh', refreshUI);
}

// ── CITATIONS ──
function openCiteModal() {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const modal = $('cite-modal');
  if (!modal) return;

  const url   = `${window.location.origin}${window.location.pathname}#detail/${entry.id}/0`;
  const brand = entry.tags?.brand || entry.id;
  const year  = entry.year || '';
  const season = entry.season ? entry.season + ' ' : '';
  // "Comme des Garçons SS 1997: Body Meets Dress; Dress Meets Body"
  const collectionTitle = entry.title
    ? entry.title
    : `${brand} ${season}${year}`.trim();
  const subtitle = entry.subtitle ? `: ${entry.subtitle}` : '';
  const fullTitle = collectionTitle + subtitle;
  const accessDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Chicago Manual of Style 17th ed. note format for a web entry
  // — author/curator (if known), "Entry Title," Site Name, accessed Date, URL.
  const chicago =
    `"${fullTitle}," THE LEXICON: Forensic Archive of Visual Culture, accessed ${accessDate}, ${url}.`;

  // BibTeX @misc with stable citekey: lexicon-<id>
  const citekey = `lexicon-${entry.id}`;
  const bibtex =
    `@misc{${citekey},\n` +
    `  title        = {{${fullTitle.replace(/[{}]/g,'')}}},\n` +
    `  howpublished = {{THE LEXICON: Forensic Archive of Visual Culture}},\n` +
    `  year         = {${year}},\n` +
    `  note         = {Entry ID: ${entry.id}. Accessed ${accessDate}.},\n` +
    `  url          = {${url}}\n` +
    `}`;

  if ($('cite-chicago')) $('cite-chicago').textContent = chicago;
  if ($('cite-bibtex'))  $('cite-bibtex').textContent  = bibtex;
  if ($('cite-url'))     $('cite-url').textContent     = url;

  modal.classList.remove('hidden');
}

// ── LIGHTBOX ──
let _lightboxZoomed = false;
function openLightbox() {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry || !entry.images?.length) return;
  const box = $('image-lightbox');
  if (!box) return;
  box.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  _lightboxZoomed = false;
  renderLightbox();
}
function closeLightbox() {
  const box = $('image-lightbox');
  if (!box) return;
  box.classList.add('hidden');
  document.body.style.overflow = '';
  const img = $('lightbox-image');
  if (img) { img.style.transform = ''; img.style.cursor = ''; }
  _lightboxZoomed = false;
}
function renderLightbox() {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const idx = AppState.currentImageIndex;
  const imgs = entry.images || [];
  const current = imgs[idx];
  if (!current) return;
  const img = $('lightbox-image');
  const webp = $('lightbox-image-webp');
  const counter = $('lightbox-counter');
  if (img) {
    if (webp) webp.srcset = resolveImgSrc({ src: webpSrc(current) });
    img.src = resolveImgSrc(current);
    img.alt = getTranslation(entry.title || entry.id, AppState.language);
    img.style.transform = '';
  }
  if (counter) counter.textContent = (idx + 1) + ' / ' + imgs.length;
  _lightboxZoomed = false;
  $('lightbox-stage').style.cursor = 'zoom-in';
}
function navigateLightbox(direction) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const imgs = entry.images || [];
  if (imgs.length <= 1) return;
  let next = AppState.currentImageIndex + direction;
  if (next < 0) next = imgs.length - 1;
  if (next >= imgs.length) next = 0;
  AppState.currentImageIndex = next;
  renderLightbox();
}
function toggleLightboxZoom(e) {
  const img = $('lightbox-image');
  const stage = $('lightbox-stage');
  if (!img || !stage) return;
  if (_lightboxZoomed) {
    img.style.transform = '';
    stage.style.cursor = 'zoom-in';
    _lightboxZoomed = false;
  } else {
    // Zoom 2.5× toward click point
    const rect = img.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const originX = (offsetX / rect.width) * 100;
    const originY = (offsetY / rect.height) * 100;
    img.style.transformOrigin = `${originX}% ${originY}%`;
    img.style.transform = 'scale(2.5)';
    stage.style.cursor = 'zoom-out';
    _lightboxZoomed = true;
  }
}

function openMobileNotes() {
  const sheet = $('mobile-notes-sheet');
  if (!sheet) return;
  sheet.classList.remove('hidden');
  // Default to provenance tab
  showMobileNote('provenance');
}

function showMobileNote(type) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry || !entry.notes) return;
  const lang = AppState.language;
  const labels = {
    provenance: getTranslation('note_provenance', lang),
    critique:   getTranslation('note_critique', lang),
    strategy:   getTranslation('note_strategy', lang)
  };
  const colors = {
    provenance: { bg: '#E6FF00', fg: '#000' },
    critique:   { bg: '#FF0000', fg: '#fff' },
    strategy:   { bg: '#0000FF', fg: '#fff' }
  };
  let raw = entry.notes[type] || '';
  let text = getTranslation(raw, lang).replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();
  const titleEl = $('mobile-notes-title');
  const bodyEl  = $('mobile-notes-body');
  if (titleEl) {
    titleEl.textContent = labels[type] || type.toUpperCase();
    const hdr = titleEl.parentElement;
    if (hdr && colors[type]) {
      hdr.style.background = colors[type].bg;
      hdr.style.color      = colors[type].fg;
    }
  }
  if (bodyEl) bodyEl.textContent = text || '—';
  // Visual active state on tabs
  document.querySelectorAll('.mobile-note-tab').forEach(t => {
    if (t.dataset.mobileNote === type) {
      t.style.background = colors[type].bg;
      t.style.color      = colors[type].fg;
    } else {
      t.style.background = '';
      t.style.color      = '';
    }
  });
}

function toggleHamburger() {
  const panel    = $('index-panel');
  const backdrop = $('drawer-backdrop');
  const btn      = $('btn-hamburger');
  if (!panel || !backdrop || !btn) return;
  const isOpen = panel.classList.contains('translate-x-0');
  if (isOpen) {
    panel.classList.remove('translate-x-0');
    panel.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  } else {
    panel.classList.add('translate-x-0');
    panel.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    // Prevent body scroll behind the mobile drawer; desktop is unaffected
    // because the drawer transform is a no-op at lg breakpoint.
    if (window.innerWidth < 1024) document.body.style.overflow = 'hidden';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('lexicon-theme', isDark ? 'dark' : 'light'); } catch(e) {}
  refreshUI();
}

const LANG_DISPLAY = {
  'en':    'English',
  'en-gb': 'English (GB)',
  'en-us': 'English (US)',
  'fr':    'Français',
  'it':    'Italiano',
  'es':    'Español',
  'de':    'Deutsch',
  'pt':    'Português',
  'ru':    'Русский',
  'zh':    '中文',
  'ja':    '日本語',
  'ko':    '한국어'
};

function renderLangDropdown() {
  const dd = $('lang-dropdown');
  if (!dd) return;
  dd.innerHTML = supportedLanguages.map(code => {
    const name = LANG_DISPLAY[code] || code.toUpperCase();
    const isActive = code === AppState.language;
    const activeClass = isActive ? 'bg-black text-white dark:bg-acid dark:text-black' : 'hover:bg-black/10 dark:hover:bg-white/10';
    return `<li><button type="button" role="option" aria-selected="${isActive}" data-lang-code="${code}" class="w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest ${activeClass} transition-colors flex items-center justify-between gap-3">
      <span>${name}</span><span class="opacity-50 text-[8px]">${code.toUpperCase()}</span>
    </button></li>`;
  }).join('');
  dd.querySelectorAll('[data-lang-code]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-lang-code');
      if (!code || code === AppState.language) {
        dd.classList.add('hidden');
        return;
      }
      AppState.language = code;
      try { localStorage.setItem('lexicon-lang', code); } catch(e) {}
      dd.classList.add('hidden');
      $('btn-lang-toggle')?.setAttribute('aria-expanded', 'false');
      refreshUI();
      showToast(getTranslation('toast_language', code) + ' ' + code.toUpperCase());
    });
  });
}

function toggleLangDropdown() {
  const dd = $('lang-dropdown');
  const btn = $('btn-lang-toggle');
  if (!dd) return;
  const isHidden = dd.classList.contains('hidden');
  dd.classList.toggle('hidden');
  if (btn) btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
}

function toggleLanguage() {
  let idx = supportedLanguages.indexOf(AppState.language);
  idx = (idx + 1) % supportedLanguages.length;
  AppState.language = supportedLanguages[idx];
  try { localStorage.setItem('lexicon-lang', AppState.language); } catch(e) {}
  refreshUI();
  showToast(getTranslation('toast_language', AppState.language) + ' ' + AppState.language.toUpperCase());
}

function renderFoldersView() {
  const container = $('folders-grid');
  if (!container) return;
  container.innerHTML = '';
  if (AppState.archivalFolders.length === 0) {
    container.innerHTML = `<p class="text-[10px] font-mono uppercase opacity-40">${getTranslation('folder_no_detected', AppState.language)}</p>`;
    return;
  }
  AppState.archivalFolders.forEach(fol => {
    const card = document.createElement('div');
    card.className = 'bg-bone dark:bg-darkBase border border-black dark:border-white p-6 cursor-crosshair hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-all';
    card.innerHTML = `
      <div class="flex items-baseline justify-between mb-4">
        <h3 class="text-xs font-bold font-mono uppercase tracking-[0.1em]">${fol.name}</h3>
        <button class="btn-export-fol text-[9px] font-mono uppercase opacity-40 group-hover:opacity-100 underline">EXPORT_JSON</button>
      </div>
      <p class="text-[10px] font-mono opacity-60 mb-4">${fol.notes ? fol.notes : getTranslation('no_obs_logged', AppState.language)}</p>
      <div class="flex gap-6 text-[9px] font-mono uppercase opacity-50">
        <span>${fol.lookIds ? fol.lookIds.length : 0} ${getTranslation('artifacts_count', AppState.language)}</span>
        <span>${new Date(fol.createdAt).toLocaleDateString()}</span>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-export-fol')) { e.stopPropagation(); exportFolder(fol.id); return; }
      AppState.activeFolderId = fol.id;
      switchView('grid', callbacks);
      refreshUI();
      showToast(getTranslation('toast_browsing', AppState.language) + ' ' + fol.name);
    });
    container.appendChild(card);
  });
}

function renderSaveFolderModal() {
  const container = $('folder-list-container');
  if (!container) return;
  container.innerHTML = '';
  if (AppState.archivalFolders.length === 0) {
    container.innerHTML = `<p class="text-[10px] font-mono uppercase opacity-40">${getTranslation('folder_no_existing', AppState.language)}</p>`;
    return;
  }
  AppState.archivalFolders.forEach(fol => {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left border border-black/10 dark:border-white/10 p-3 text-[10px] font-mono uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-colors flex justify-between items-center';
    btn.innerHTML = `<span>${fol.name}</span><span class="opacity-40">${fol.lookIds ? fol.lookIds.length : 0}</span>`;
    btn.addEventListener('click', () => {
      saveToFolder(fol.id, AppState.selectedEntryId, callbacks);
      const modal = $('save-folder-modal');
      if (modal) modal.classList.add('hidden');
    });
    container.appendChild(btn);
  });
}

function exportFolder(folId) {
  const fol = AppState.archivalFolders.find(f => f.id === folId);
  if (!fol) return;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fol, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `lexicon_folder_${fol.name.toLowerCase()}.json`);
  a.click();
}

function exportAllFolders() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(AppState.archivalFolders, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'lexicon_all_folders.json');
  a.click();
}

