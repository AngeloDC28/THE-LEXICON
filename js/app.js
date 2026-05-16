/**
 * app.js
 * Entry point for THE LEXICON.
 * Orchestrates module initialization and global event delegation.
 */

import { archiveData } from '../database.js';
import { $, $$, debounce, initCustomCursor, showToast } from './modules/core-utils.js';
import { AppState, updateHash } from './modules/core-state.js';
import { renderTaxonomyGrid, renderTaxonomySub, getFilteredEntries, setActiveTaxonomy } from './modules/search-engine.js';
import { renderImageGrid, renderEntryList } from './modules/render-grid.js';
import { openDetail, closeDetail, navigateEntry, updateStatusBar } from './modules/render-detail.js';
import { initHotspotInteractions, cleanupHotspots, toggleMobileHotspots } from './modules/hotspots.js';
import { initDockInteractions, setStickyNote } from './modules/sticky-notes.js';
import { switchView } from './modules/navigation.js';
import { openConnectionMatrix, closeConnectionMatrix } from './modules/connection-matrix.js';
import { updateTelemetry, initHeaderTypewriter, updateHeaderTelemetry } from './modules/telemetry.js';
import { initFirebaseAuth, toggleAuth, sendSignInLink, createArchivalFolder, saveToFolder, currentUser, fetchArchivalFolders } from './modules/auth.js';
import { addRecentlyViewed, renderRecentlyViewed, toggleBookmark, isBookmarked } from './modules/storage.js';
import { toggleCmdPalette, handleCmdKeydown, renderCmdResults } from './modules/command-palette.js';
import { renderTimeline, renderFilterChips, updateMetaForEntry, resetMeta, extractAccentColor } from './modules/ui-extras.js';
import { getTranslation, supportedLanguages } from './modules/translations.js';

// --- Shared Callbacks ---
const callbacks = {
  openDetail: (id, idx = 0) => openDetail(id, idx, archiveData, callbacks),
  closeDetail: () => closeDetail(callbacks, archiveData),
  navigateEntry: (dir) => navigateEntry(dir, archiveData, callbacks),
  showToast: showToast,
  showAnnouncement: (msg) => {
    const announcer = $('aria-announcer');
    if (announcer) announcer.textContent = msg;
  },
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
  console.log('LEXICON_BOOT: INITIALIZING_ARCHIVE_CORE...');
  console.log('LEXICON_DATA_AUDIT: ENTRIES_DETECTED =', archiveData.length);

  if (!archiveData || archiveData.length === 0) {
    console.error('LEXICON_DATA_EXCEPTION: ARCHIVE_DATA_LOAD_FAILED_OR_EMPTY');
    return;
  }

  // Initial State
  AppState.archivalFolders = fetchArchivalFolders();

  // Systems
  initCustomCursor();
  initHeaderTypewriter();
  // Pass archiveData to hotspots so it doesn't need to import database.js itself
  initHotspotInteractions(archiveData);
  initDockInteractions();
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

  const btnLang = $('btn-lang-toggle');
  const btnLangMobile = $('btn-lang-toggle-mobile');
  if (btnLang) btnLang.textContent = t('nav_language').toUpperCase();
  if (btnLangMobile) btnLangMobile.textContent = (t('nav_language') + ': ' + lang.toUpperCase()).toUpperCase();

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

  // --- Active Entry Detail ---
  const btnSaveFolder       = $('btn-save-to-folder');
  const btnSaveFolderMobile = $('btn-save-folder-mobile');
  if (btnSaveFolder)       btnSaveFolder.textContent       = t('btn_save_folder');
  if (btnSaveFolderMobile) btnSaveFolderMobile.textContent = t('btn_save_folder');

  const btnNexus = $('btn-open-matrix');
  if (btnNexus) btnNexus.textContent = t('btn_view_nexus');

  const btnBackGrid = $('btn-back-grid');
  if (btnBackGrid) btnBackGrid.textContent = t('btn_back_grid');


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

  // --- Taxonomy ---
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

function handleRouting() {
  const hash = window.location.hash;
  if (!hash) { switchView('grid', callbacks); return; }

  if (hash.startsWith('#detail/')) {
    const parts = hash.replace('#detail/', '').split('/');
    const id  = parts[0];
    const idx = parts[1] ? parseInt(parts[1]) : 0;
    openDetail(id, idx, archiveData, callbacks);
  } else if (hash === '#folders') {
    switchView('folders', callbacks);
  } else if (hash === '#timeline') {
    switchView('timeline', callbacks);
  } else if (hash === '#grid') {
    switchView('grid', callbacks);
  } else {
    const potentialId = hash.replace('#', '');
    const entry = archiveData.find(e => e.id === potentialId);
    if (entry) {
      openDetail(potentialId, 0, archiveData, callbacks);
    } else {
      switchView('grid', callbacks);
    }
  }
}

function setupEventListeners() {
  console.log('EVENT_SYSTEM: Binding listeners...');

  // Global Click Delegation
  document.addEventListener('click', (e) => {

    // Grid Cell Click
    const gridCell = e.target.closest('.grid-cell');
    if (gridCell) {
      const id  = gridCell.dataset.entryId;
      const idx = gridCell.dataset.imgIndex || 0;
      console.log('LEXICON_ACTION: GRID_CELL_NAV', id, idx);
      window.location.hash = `detail/${id}/${idx}`;
      return;
    }

    // Entry Item Click (A-Z Index)
    const entryItem = e.target.closest('.entry-item');
    if (entryItem) {
      const id = entryItem.dataset.id;
      console.log('LEXICON_ACTION: ENTRY_ITEM_NAV', id);
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
    // Tier 1: category type button (has data-taxonomy-type but NOT data-taxonomy-val)
    const taxType = e.target.closest('[data-taxonomy-type]');
    if (taxType && !taxType.dataset.taxonomyVal) {
      const type = taxType.dataset.taxonomyType;
      setActiveTaxonomy(type);
      renderTaxonomyGrid();
      renderTaxonomySub(callbacks);
      return;
    }

    // Tier 2: value button (has both data-taxonomy-type and data-taxonomy-val)
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
    AppState.filters = { brand: null, era: null, politics: null, theories: null, gender: null, materials: null, geography: null, format: null, anatomy: null };
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
  $('btn-lang-toggle')?.addEventListener('click', toggleLanguage);
  $('btn-auth-toggle')?.addEventListener('click', toggleAuth);
  $('btn-theme-toggle-mobile')?.addEventListener('click', toggleTheme);
  $('btn-lang-toggle-mobile')?.addEventListener('click', toggleLanguage);
  $('btn-auth-toggle-mobile')?.addEventListener('click', toggleAuth);

  // Modals
  $('btn-about')?.addEventListener('click', () => $('about-modal').classList.remove('hidden'));
  $('btn-contact')?.addEventListener('click', () => $('contact-modal').classList.remove('hidden'));
  $('btn-about-mobile')?.addEventListener('click', () => { $('about-modal').classList.remove('hidden'); toggleHamburger(); });
  $('btn-contact-mobile')?.addEventListener('click', () => { $('contact-modal').classList.remove('hidden'); toggleHamburger(); });
  $('btn-privacy-link')?.addEventListener('click', () => $('privacy-modal').classList.remove('hidden'));
  $('btn-terms-link')?.addEventListener('click', () => $('terms-modal').classList.remove('hidden'));

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
    AppState.filters = { brand: null, era: null, politics: null, theories: null, gender: null, materials: null, geography: null, format: null, anatomy: null };
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
  $('btn-dismiss-orientation')?.addEventListener('click', () => {
    const op = $('orientation-panel');
    if (op) op.classList.add('hidden');
    try { localStorage.setItem('lexicon-orientation-dismissed', 'true'); } catch(e) {}
  });

  // --- View Toggles ---
  $('btn-toggle-grid')?.addEventListener('click', () => switchView('grid', callbacks));
  $('btn-toggle-timeline')?.addEventListener('click', () => switchView('timeline', callbacks));

  // Detail
  $('btn-close-detail')?.addEventListener('click', () => closeDetail(callbacks, archiveData));
  $('btn-back-grid')?.addEventListener('click', () => closeDetail(callbacks, archiveData));
  $('btn-viewer-prev')?.addEventListener('click', () => navigateEntry(-1, archiveData, callbacks));
  $('btn-viewer-next')?.addEventListener('click', () => navigateEntry(1, archiveData, callbacks));

  $('btn-bookmark-entry')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) toggleBookmark(AppState.selectedEntryId, callbacks);
  });

  $('btn-open-matrix')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) openConnectionMatrix(AppState.selectedEntryId, archiveData, callbacks);
  });
  $('btn-close-matrix')?.addEventListener('click', () => closeConnectionMatrix());
  $('matrix-backdrop')?.addEventListener('click', () => closeConnectionMatrix());

  $('btn-save-to-folder')?.addEventListener('click', () => {
    if (!currentUser) { showToast('Authentication required.'); toggleAuth(); return; }
    $('save-folder-modal').classList.remove('hidden');
    renderSaveFolderModal();
  });
  $('btn-save-folder-mobile')?.addEventListener('click', () => {
    if (!currentUser) { showToast('Authentication required.'); toggleAuth(); return; }
    $('save-folder-modal').classList.remove('hidden');
    renderSaveFolderModal();
  });

  $('btn-export-all-folders')?.addEventListener('click', () => exportAllFolders());

  // Hotspot interaction is now handled in render-detail.js per-render.


  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (AppState.selectedEntryId) {
      if (e.key === 'ArrowLeft')  navigateEntry(-1, archiveData, callbacks);
      else if (e.key === 'ArrowRight') navigateEntry(1, archiveData, callbacks);
      else if (e.key === 'Escape')     closeDetail(callbacks, archiveData);
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
  } else {
    panel.classList.add('translate-x-0');
    panel.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('lexicon-theme', isDark ? 'dark' : 'light'); } catch(e) {}
  refreshUI();
}

function toggleLanguage() {
  let idx = supportedLanguages.indexOf(AppState.language);
  idx = (idx + 1) % supportedLanguages.length;
  AppState.language = supportedLanguages[idx];
  try { localStorage.setItem('lexicon-lang', AppState.language); } catch(e) {}
  refreshUI();
  showToast(`Terminal Language: ${AppState.language.toUpperCase()}`);
}

function renderFoldersView() {
  const container = $('folders-grid');
  if (!container) return;
  container.innerHTML = '';
  if (AppState.archivalFolders.length === 0) {
    container.innerHTML = '<p class="text-[10px] font-mono uppercase opacity-40">No Archival Folders Detected.</p>';
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
      <p class="text-[10px] font-mono opacity-60 mb-4">${fol.notes ? fol.notes : 'No observations logged.'}</p>
      <div class="flex gap-6 text-[9px] font-mono uppercase opacity-50">
        <span>${fol.lookIds ? fol.lookIds.length : 0} Artifacts Audited</span>
        <span>${new Date(fol.createdAt).toLocaleDateString()}</span>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-export-fol')) { e.stopPropagation(); exportFolder(fol.id); return; }
      AppState.activeFolderId = fol.id;
      switchView('grid', callbacks);
      refreshUI();
      showToast(`Browsing ${fol.name}`);
    });
    container.appendChild(card);
  });
}

function renderSaveFolderModal() {
  const container = $('folder-list-container');
  if (!container) return;
  container.innerHTML = '';
  if (AppState.archivalFolders.length === 0) {
    container.innerHTML = '<p class="text-[10px] font-mono uppercase opacity-40">No existing folders found.</p>';
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

