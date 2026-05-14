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
import { initHotspotInteractions, cleanupHotspots, toggleMobileHotspots, toggleMobileDock } from './modules/hotspots.js';
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
  refreshUI,
  openDetail: (id, idx) => openDetail(id, idx, archiveData, callbacks),
  closeDetail: () => closeDetail(callbacks, archiveData),
  navigateEntry: (dir) => navigateEntry(dir, archiveData, callbacks),
  renderGrid: () => renderImageGrid(getFilteredEntries(archiveData, AppState), callbacks),
  renderList: () => renderEntryList(getFilteredEntries(archiveData, AppState), callbacks),
  renderTimeline: () => renderTimeline(getFilteredEntries(archiveData, AppState), callbacks),
  renderFilterChips: () => renderFilterChips(AppState),
  switchView: (view) => switchView(view, callbacks),
  updateStatusBar: () => updateStatusBar(archiveData, AppState),
  toggleBookmark: (id) => toggleBookmark(id, callbacks),
  isBookmarked: (id) => isBookmarked(id),
  closeModal: (id) => {
    const modal = $(id + '-modal');
    if (modal) modal.classList.add('hidden');
  },
  getArchiveData: () => archiveData,
  getAppState: () => AppState,
};

// --- App Init ---
async function init() {
  console.log('LEXICON_BOOT: Initializing...');
  initCustomCursor();
  await initFirebaseAuth(callbacks);
  await fetchArchivalFolders(callbacks);
  renderRecentlyViewed(archiveData, callbacks);
  renderTaxonomyGrid();
  renderTaxonomySub(callbacks);
  switchView('grid', callbacks);
  refreshUI();
  initHeaderTypewriter();
  updateTelemetry(archiveData);
  initDockInteractions(callbacks);
  setupEventListeners();
  handleHashOnLoad();
  showOrientationPanel();
  showCookieConsent();

  // Pass archiveData to hotspots so it doesn't need to import database.js itself
  initHotspotInteractions(archiveData, callbacks);

  // Dismiss boot overlay once app is genuinely ready
  const overlay = $('boot-overlay');
  const root    = $('app-root');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (root) root.classList.remove('opacity-0');
    }, 500);
  } else if (root) {
    root.classList.remove('opacity-0');
  }

  console.log('LEXICON_BOOT: Ready.');
}

init().catch(err => {
  console.error('LEXICON_BOOT_ERROR:', err);
  // Fail-safe: ensure app is visible even on error
  const overlay = $('boot-overlay');
  const root    = $('app-root');
  if (overlay) overlay.classList.add('hidden');
  if (root) root.classList.remove('opacity-0');
});

function refreshUI() {
  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);

  const btnAuth = $('btn-auth-toggle');
  const btnAuthMobile = $('btn-auth-toggle-mobile');
  if (currentUser) {
    if (btnAuth) btnAuth.textContent = t('nav_signout').toUpperCase();
    if (btnAuthMobile) btnAuthMobile.textContent = t('nav_signout_mobile').toUpperCase();
  } else {
    if (btnAuth) btnAuth.textContent = t('nav_signin').toUpperCase();
    if (btnAuthMobile) btnAuthMobile.textContent = t('nav_signin_mobile').toUpperCase();
  }

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
  const langLabelDesktop = document.getElementById('lang-toggle-label');
  const langLabelMobile  = document.getElementById('lang-toggle-label-mobile');
  if (langLabelDesktop) langLabelDesktop.textContent = (t('nav_language') + ' [' + lang.toUpperCase() + ']').toUpperCase();
  else if (btnLang) btnLang.textContent = t('nav_language').toUpperCase();
  if (langLabelMobile) langLabelMobile.textContent = (t('nav_language') + ': ' + lang.toUpperCase()).toUpperCase();
  else if (btnLangMobile) btnLangMobile.textContent = (t('nav_language') + ': ' + lang.toUpperCase()).toUpperCase();

  const btnTheme = $('btn-theme-toggle');
  const btnThemeMobile = $('btn-theme-toggle-mobile');
  const isDark = document.documentElement.classList.contains('dark');
  const themeText = isDark ? t('nav_theme_dark') : t('nav_theme_light');
  if (btnTheme) btnTheme.textContent = themeText.toUpperCase();
  if (btnThemeMobile) btnThemeMobile.textContent = t('nav_theme_mobile').toUpperCase();

  const btnFoldersMobile = $('btn-folders-toggle-mobile');
  if (btnFoldersMobile) btnFoldersMobile.textContent = t('nav_folders_mobile').toUpperCase();

  const searchInput = $('search-input');
  if (searchInput) searchInput.placeholder = t('search_placeholder');

  const indexTitle = $('index-panel-title');
  if (indexTitle) indexTitle.textContent = t('index_title').toUpperCase();

  const savedLabel = $('label-saved');
  if (savedLabel) savedLabel.textContent = t('index_saved').toUpperCase();

  const recentLabel = $('label-recent');
  if (recentLabel) recentLabel.textContent = t('index_recent').toUpperCase();

  const taxonomyMapTitle = $('taxonomy-map-title');
  if (taxonomyMapTitle) taxonomyMapTitle.textContent = t('taxonomy_map').toUpperCase();

  const clearBtn = $('btn-clear-directory');
  if (clearBtn) clearBtn.textContent = t('btn_clear_filter');

  const foldersTitle = $('folders-panel-title');
  if (foldersTitle) foldersTitle.textContent = t('folders_title').toUpperCase();

  const btnExport = $('btn-export-all-folders');
  if (btnExport) btnExport.textContent = t('folders_export');

  const authTitle = $$('#auth-modal h2')[0];
  if (authTitle) authTitle.textContent = t('modal_terminal_access');
  const authDesc = $$('#auth-modal p')[0];
  if (authDesc) authDesc.textContent = t('modal_auth_desc');
  const btnSubmitAuth = $('btn-submit-auth');
  if (btnSubmitAuth) btnSubmitAuth.textContent = t('modal_auth_transmit');

  const saveFolderTitle = $$('#save-folder-modal h2')[0];
  if (saveFolderTitle) saveFolderTitle.textContent = t('btn_save_folder');
  const newFolderLabel = $$('#save-folder-modal label')[0];
  if (newFolderLabel) newFolderLabel.textContent = t('btn_save_folder');

  const relatedTitle = $('related-artifacts-title');
  if (relatedTitle) relatedTitle.textContent = t('related_artifacts').toUpperCase();

  const btnViewGrid = $('btn-toggle-grid');
  if (btnViewGrid) btnViewGrid.textContent = t('view_archive_grid');
  const btnViewTimeline = $('btn-toggle-timeline');
  if (btnViewTimeline) btnViewTimeline.textContent = t('view_evolution_matrix');

  const aboutTitle = $('about-modal-title');
  if (aboutTitle) aboutTitle.textContent = t('modal_about_title');
  const aboutBody = $('about-modal-body');
  if (aboutBody)
    aboutBody.innerHTML = t('modal_about_body').map(p => `<p>${p}</p>`).join('');

  const contactTitle = $('contact-modal-title');
  if (contactTitle) contactTitle.textContent = t('modal_contact_title');
  const contactBody = $('contact-modal-body');
  if (contactBody)
    contactBody.innerHTML = t('modal_contact_body').map(p => `<p>${p}</p>`).join('');

  const privacyTitle = $('privacy-modal-title');
  if (privacyTitle) privacyTitle.textContent = t('legal_privacy_title');
  const privacyBody = $('privacy-modal-body');
  if (privacyBody)
    privacyBody.innerHTML = t('legal_privacy_body').map(p => `<p>${p}</p>`).join('');

  const termsTitle = $('terms-modal-title');
  if (termsTitle) termsTitle.textContent = t('legal_terms_title');
  const termsBody = $('terms-modal-body');
  if (termsBody)
    termsBody.innerHTML = t('legal_terms_body').map(p => `<p>${p}</p>`).join('');

  // Telemetry
  updateHeaderTelemetry(archiveData, AppState, t);

  // Re-render current view
  if (AppState.currentView === 'grid') {
    renderImageGrid(getFilteredEntries(archiveData, AppState), callbacks);
    renderEntryList(getFilteredEntries(archiveData, AppState), callbacks);
  } else if (AppState.currentView === 'timeline') {
    renderTimeline(getFilteredEntries(archiveData, AppState), callbacks);
  } else if (AppState.currentView === 'folders') {
    renderFoldersView();
  }
  renderFilterChips(AppState);
  renderTaxonomySub(callbacks);
  renderRecentlyViewed(archiveData, callbacks);

  if (AppState.selectedEntryId) {
    updateStatusBar(archiveData, AppState);
    updateMetaForEntry(AppState.selectedEntryId, archiveData);
  }
}

function handleHashOnLoad() {
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('detail/')) {
    const parts = hash.split('/');
    const id  = parts[1];
    const idx = parseInt(parts[2]) || 0;
    if (id) openDetail(id, idx, archiveData, callbacks);
  }
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '');
    if (h.startsWith('detail/')) {
      const p = h.split('/');
      openDetail(p[1], parseInt(p[2]) || 0, archiveData, callbacks);
    } else if (h === 'grid') {
      closeDetail(callbacks, archiveData);
    }
  });
}

function showOrientationPanel() {
  let dismissed = false;
  try { dismissed = localStorage.getItem('lexicon-orientation-dismissed'); } catch(e) {}
  if (!dismissed) {
    const op = $('orientation-panel');
    if (op) op.classList.remove('hidden');
  }
}

function showCookieConsent() {
  let cookieAccepted = false;
  try { cookieAccepted = localStorage.getItem('lexicon-terms-accepted'); } catch(e) {}
  if (!cookieAccepted) {
    const cookieBanner = $('cookie-consent');
    if (cookieBanner) cookieBanner.classList.remove('hidden');
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
    if (e.target.id === 'btn-taxonomy-back') {
      AppState.activeTaxonomy = null;
      renderTaxonomyGrid();
      renderTaxonomySub(callbacks);
      return;
    }
    // ────────────────────────────────────────────────────────────

    // Mobile Dock Close
    if (e.target.id === 'btn-close-dock') toggleMobileDock(false);
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
  $('btn-lang-toggle')?.addEventListener('click', openLangDropdown);
  $('btn-auth-toggle')?.addEventListener('click', toggleAuth);
  $('btn-theme-toggle-mobile')?.addEventListener('click', toggleTheme);
  $('btn-lang-toggle-mobile')?.addEventListener('click', openLangDropdown);
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

  // Modal close handlers — single delegated registration only
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

  $('btn-save-to-folder')?.addEventListener('click', () => {
    if (!currentUser) { showToast('Authentication required.'); toggleAuth(); return; }
    $('save-folder-modal').classList.remove('hidden');
    renderSaveFolderModal();
  });

  $('btn-new-folder')?.addEventListener('click', () => {
    if (!currentUser) { showToast('Authentication required.'); toggleAuth(); return; }
    $('save-folder-modal').classList.remove('hidden');
    renderSaveFolderModal();
  });

  // Image hotspots
  $('btn-toggle-hotspots')?.addEventListener('click', toggleMobileHotspots);

  // Cookie consent
  $('btn-accept-terms')?.addEventListener('click', () => {
    const cookieBanner = $('cookie-consent');
    if (cookieBanner) cookieBanner.classList.add('hidden');
    try { localStorage.setItem('lexicon-terms-accepted', 'true'); } catch(e) {}
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLangDropdown();
      closeConnectionMatrix();
      if (AppState.selectedEntryId) closeDetail(callbacks, archiveData);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCmdPalette();
    }
    if (AppState.currentView === 'cmd') handleCmdKeydown(e, archiveData, callbacks);
  });

  $('btn-cmd-palette')?.addEventListener('click', toggleCmdPalette);
  $('cmd-input')?.addEventListener('input', debounce((e) => {
    renderCmdResults(e.target.value, archiveData, callbacks);
  }, 150));

  // Sticky notes
  $$('.sticky-note-textarea').forEach(ta => {
    ta.addEventListener('input', debounce((e) => {
      const key = e.target.dataset.noteKey;
      if (key) setStickyNote(key, e.target.value);
    }, 300));
  });

  // Folders
  const folderForm = $('new-folder-form');
  if (folderForm) {
    folderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('new-folder-name');
      if (input?.value.trim()) {
        await createArchivalFolder(input.value.trim(), callbacks);
        input.value = '';
      }
    });
  }

  document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.btn-save-to-existing-folder');
    if (saveBtn) {
      const folderId = saveBtn.dataset.folderId;
      if (AppState.selectedEntryId && folderId) {
        saveToFolder(AppState.selectedEntryId, folderId, callbacks);
        $('save-folder-modal').classList.add('hidden');
      }
    }
    if (e.target.classList.contains('btn-export-fol')) { e.stopPropagation(); exportFolder(e.target.closest('[data-folder-id]')?.dataset.folderId); return; }
  });

  $('btn-export-all-folders')?.addEventListener('click', exportAllFolders);
}

function toggleHamburger() {
  const drawer = $('mobile-drawer');
  const backdrop = $('drawer-backdrop');
  if (!drawer) return;
  const isOpen = !drawer.classList.contains('-translate-x-full');
  drawer.classList.toggle('-translate-x-full', isOpen);
  if (backdrop) backdrop.classList.toggle('hidden', isOpen);
}

function renderSaveFolderModal() {
  const container = $('save-folder-list');
  if (!container) return;
  container.innerHTML = '';
  if (AppState.archivalFolders.length === 0) {
    container.innerHTML = '<p class="text-[10px] font-mono uppercase opacity-40">No folders. Create one below.</p>';
    return;
  }
  AppState.archivalFolders.forEach(fol => {
    const btn = document.createElement('button');
    btn.className = 'btn-save-to-existing-folder w-full text-left text-[10px] font-mono uppercase tracking-wider py-2 px-3 border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-colors';
    btn.dataset.folderId = fol.id;
    btn.textContent = fol.name.toUpperCase();
    container.appendChild(btn);
  });
}

function exportFolder(folderId) {
  const folder = AppState.archivalFolders.find(f => f.id === folderId);
  if (!folder) return;
  const entries = (folder.entryIds || []).map(id => archiveData.find(e => e.id === id)).filter(Boolean);
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lexicon-folder-${folder.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
}

function exportAllFolders() {
  const blob = new Blob([JSON.stringify(AppState.archivalFolders, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lexicon-all-folders.json';
  a.click();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('lexicon-theme', isDark ? 'dark' : 'light'); } catch(e) {}
  refreshUI();
}

// Language display names (native script)
const LANG_NAMES = {
  en: 'EN — English',
  fr: 'FR — Français',
  it: 'IT — Italiano',
  es: 'ES — Español',
  de: 'DE — Deutsch',
  pt: 'PT — Português',
  ru: 'RU — Русский',
  zh: 'ZH — 中文',
  ja: 'JA — 日本語',
  ko: 'KO — 한국어',
};

function setLanguage(code) {
  AppState.language = code;
  try { localStorage.setItem('lexicon-lang', code); } catch(e) {}
  refreshUI();
  showToast(`Terminal Language: ${code.toUpperCase()}`);
}

function closeLangDropdown() {
  const dd = document.getElementById('lang-dropdown');
  if (dd) dd.remove();
  document.removeEventListener('click', closeLangDropdownOutside, true);
}

function closeLangDropdownOutside(e) {
  const dd = document.getElementById('lang-dropdown');
  if (dd && !dd.contains(e.target) && e.target.id !== 'btn-lang-toggle') {
    closeLangDropdown();
  }
}

function openLangDropdown(e) {
  e.stopPropagation();
  // If already open, close it (toggle)
  if (document.getElementById('lang-dropdown')) { closeLangDropdown(); return; }

  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();

  const dd = document.createElement('div');
  dd.id = 'lang-dropdown';
  dd.setAttribute('role', 'listbox');
  dd.setAttribute('aria-label', 'Select language');
  dd.style.cssText = [
    `position:fixed`,
    `z-index:9000`,
    `top:${rect.bottom + 6}px`,
    `right:${Math.max(8, window.innerWidth - rect.right)}px`,
    `min-width:200px`,
    `background:var(--tw-prose-body,#111)`,
    `border:1px solid rgba(128,128,128,0.25)`,
    `box-shadow:0 8px 32px rgba(0,0,0,0.45)`,
  ].join(';');

  // Match site theme
  const isDark = document.documentElement.classList.contains('dark');
  dd.style.background = isDark ? '#111110' : '#f5f3ed';
  dd.style.color = isDark ? '#e0dfd8' : '#1a1a18';

  supportedLanguages.forEach((code, idx) => {
    const isActive = code === AppState.language;
    const item = document.createElement('button');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    item.style.cssText = [
      `display:block`,
      `width:100%`,
      `padding:9px 14px`,
      `text-align:left`,
      `font-family:monospace`,
      `font-size:10px`,
      `font-weight:700`,
      `letter-spacing:0.1em`,
      `text-transform:uppercase`,
      `cursor:pointer`,
      `background:${isActive ? '#E6FF00' : 'transparent'}`,
      `color:${isActive ? '#111' : 'inherit'}`,
      `border:none`,
      `border-bottom:${idx < supportedLanguages.length - 1 ? '1px solid rgba(128,128,128,0.15)' : 'none'}`,
      `transition:background 120ms`,
    ].join(';');
    item.textContent = LANG_NAMES[code] || code.toUpperCase();
    item.addEventListener('mouseenter', () => {
      if (!isActive) item.style.background = 'rgba(128,128,128,0.12)';
    });
    item.addEventListener('mouseleave', () => {
      if (!isActive) item.style.background = 'transparent';
    });
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeLangDropdown();
      setLanguage(code);
    });
    dd.appendChild(item);
  });

  document.body.appendChild(dd);
  // Delay outside-click binding so the triggering click doesn't immediately close it
  setTimeout(() => document.addEventListener('click', closeLangDropdownOutside, true), 0);
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
    card.className = 'bg-bone dark:bg-darkBase border border-black dark:border-white p-6 cursor-crosshair hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-all group';
    card.dataset.folderId = fol.id;
    card.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <span class="text-[11px] font-bold font-mono uppercase tracking-wider">${fol.name}</span>
        <button class="btn-export-fol text-[9px] font-mono uppercase opacity-40 group-hover:opacity-100 underline">EXPORT_JSON</button>
      </div>
      <div class="text-[9px] font-mono opacity-60">${(fol.entryIds || []).length} ENTRIES</div>
    `;
    card.addEventListener('click', () => {
      AppState.activeFolderId = fol.id;
      switchView('grid', callbacks);
      refreshUI();
    });
    container.appendChild(card);
  });

  document.querySelectorAll('.btn-export-fol').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportFolder(btn.closest('[data-folder-id]')?.dataset.folderId);
    });
  });
}
