/**
 * app.js
 * Entry point for THE LEXICON.
 * Orchestrates module initialization and global event delegation.
 */

import { archiveData } from '../database.js';
import { $, $$, debounce, initCustomCursor, showToast } from './modules/core-utils.js';
import { AppState, updateHash } from './modules/core-state.js';
import { 
  renderTaxonomyGrid, 
  renderTaxonomySub, 
  getFilteredEntries, 
  setActiveTaxonomy 
} from './modules/search-engine.js';
import { renderImageGrid, renderEntryList } from './modules/render-grid.js';
import { openDetail, closeDetail, navigateEntry, updateStatusBar } from './modules/render-detail.js';
import { 
  initHotspotInteractions, 
  cleanupHotspots, 
  toggleMobileHotspots,
  toggleMobileDock 
} from './modules/hotspots.js';
import { 
  initDockInteractions, 
  setStickyNote 
} from './modules/sticky-notes.js';
import { switchView } from './modules/navigation.js';
import { openConnectionMatrix, closeConnectionMatrix } from './modules/connection-matrix.js';
import { 
  updateTelemetry, 
  initHeaderTypewriter, 
  updateHeaderTelemetry 
} from './modules/telemetry.js';
import { 
  initFirebaseAuth, 
  toggleAuth, 
  sendSignInLink, 
  createArchivalVolume, 
  saveToVolume,
  currentUser,
  fetchArchivalVolumes
} from './modules/auth.js';
import { 
  addRecentlyViewed, 
  renderRecentlyViewed, 
  toggleBookmark, 
  isBookmarked 
} from './modules/storage.js';
import { 
  toggleCmdPalette, 
  handleCmdKeydown, 
  renderCmdResults 
} from './modules/command-palette.js';
import { 
  renderTimeline, 
  renderFilterChips, 
  updateMetaForEntry, 
  resetMeta, 
  extractAccentColor 
} from './modules/ui-extras.js';
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
  renderVolumes: () => renderVolumesView(),
  renderVolumeOptions: () => renderSaveToVolumeModal(),
  updateBookmarkUI: (id) => {
    const btn = $('btn-bookmark-entry');
    if (btn) {
      btn.style.opacity = isBookmarked(id) ? '1' : '0.4';
    }
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
  switchView: (view) => switchView(view, callbacks)
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("BOOT: DOMContentLoaded fired");
  initCustomCursor();
  initHeaderTypewriter();
  updateTelemetry();
  initFirebaseAuth(callbacks);
  initDockInteractions();
  initHotspotInteractions();
  console.log("BOOT: Basic modules initialized");
  renderRecentlyViewed(archiveData, callbacks);
  
  // Initial render
  try {
    refreshUI();
  } catch (e) {
    console.error("BOOT_INITIAL_RENDER_ERROR:", e);
  }

  // Hash Routing
  window.addEventListener('hashchange', handleRouting);
  handleRouting();

  // Global Event Delegation
  console.log("BOOT: Setting up event listeners...");
  setupEventListeners();
  console.log("BOOT: Initialization sequence complete.");

  document.addEventListener('lexicon-refresh', () => refreshUI());

  // Auto-dismiss boot overlay
  setTimeout(() => {
    const overlay = $('boot-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.5s ease-out';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.classList.add('hidden'), 500);
    }
  }, 1000);
});

function refreshUI() {
  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);

  // Language buttons
  const btnLang = $('btn-lang-toggle');
  if (btnLang) btnLang.textContent = lang.toUpperCase();
  const btnLangMob = $('btn-lang-toggle-mobile');
  if (btnLangMob) btnLangMob.textContent = `${t('nav_language')}: ${lang.toUpperCase()}`;

  // Localize Header
  const btnVolumes = $('btn-volumes-toggle');
  if (btnVolumes) btnVolumes.textContent = t('nav_volumes');
  const btnTheme = $('btn-theme-toggle');
  if (btnTheme) btnTheme.textContent = document.documentElement.classList.contains('dark') ? t('nav_theme_dark') : t('nav_theme_light');
  const btnAuth = $('btn-auth-toggle');
  if (btnAuth && !currentUser) btnAuth.textContent = t('nav_signin');
  const btnAbout = $('btn-about');
  if (btnAbout) btnAbout.textContent = t('nav_about');
  const btnContact = $('btn-contact');
  if (btnContact) btnContact.textContent = t('nav_contact');

  // Localize Search & Index
  const indexTitle = $('index-panel-title');
  if (indexTitle) indexTitle.textContent = t('index_title');
  const btnBookmarks = $('btn-show-bookmarks');
  if (btnBookmarks) btnBookmarks.textContent = t('index_saved');
  const taxMapLabel = $('taxonomy-map-label');
  if (taxMapLabel) taxMapLabel.textContent = t('taxonomy_map');

  const searchInput = $('search-input');
  if (searchInput) searchInput.placeholder = t('search_placeholder');
  const btnClearDir = $('btn-clear-directory');
  if (btnClearDir) btnClearDir.textContent = t('search_clear');
  const btnGridLabels = $('btn-toggle-grid-meta');
  if (btnGridLabels) btnGridLabels.textContent = t('search_show_labels');

  // Status Ribbon
  const statusLabels = {
    'status-brand': 'status_brand',
    'status-year': 'status_year',
    'status-season': 'status_season',
    'status-entry': 'status_entry'
  };
  Object.entries(statusLabels).forEach(([id, key]) => {
    const el = $(id)?.previousElementSibling;
    if (el) el.textContent = t(key);
  });

  // Volumes View
  const volTitle = $$('#volumes-view h1')[0];
  if (volTitle) volTitle.textContent = t('volumes_title');
  const btnExport = $('btn-export-all-volumes');
  if (btnExport) btnExport.textContent = t('volumes_export');

  // Modals & General
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

  const filtered = getFilteredEntries(archiveData);
  renderImageGrid(filtered, callbacks);
  renderTimeline(filtered, callbacks);
  renderEntryList(archiveData, callbacks);
  renderTaxonomyGrid(callbacks);
  renderTaxonomySub(callbacks);
  renderFilterChips(callbacks);
  updateStatusBar(archiveData);
}


function handleRouting() {
  const hash = window.location.hash;
  if (hash.startsWith('#detail/')) {
    const id = hash.replace('#detail/', '');
    openDetail(id, 0, archiveData, callbacks);
  }
 else if (hash === '#volumes') {
    switchView('volumes', callbacks);
  } else if (hash === '#timeline') {
    switchView('timeline', callbacks);
  } else if (hash === '#grid' || hash === '') {
    switchView('grid', callbacks);
  }
}

function setupEventListeners() {
  console.log("EVENT_SYSTEM: Binding listeners...");
  // --- Header ---
  $('header-title')?.addEventListener('click', () => {
    AppState.filters = { brand: null, era: null, politics: null, theories: null, gender: null, materials: null, geography: null, format: null, anatomy: null };
    AppState.searchQuery = '';
    AppState.activeVolumeId = null;
    if ($('search-input')) $('search-input').value = '';
    switchView('grid', callbacks);
    refreshUI();
    updateHash('grid');
  });

  $('btn-volumes-toggle')?.addEventListener('click', () => switchView('volumes', callbacks));
  $('btn-volumes-toggle-mobile')?.addEventListener('click', () => {
    switchView('volumes', callbacks);
    toggleHamburger();
  });

  $('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  $('btn-theme-toggle-mobile')?.addEventListener('click', toggleTheme);

  $('btn-auth-toggle')?.addEventListener('click', toggleAuth);
  $('btn-auth-toggle-mobile')?.addEventListener('click', toggleAuth);

  $('btn-about')?.addEventListener('click', () => $('about-modal').classList.remove('hidden'));
  $('btn-about-mobile')?.addEventListener('click', () => {
    $('about-modal').classList.remove('hidden');
    toggleHamburger();
  });

  $('btn-contact')?.addEventListener('click', () => $('contact-modal').classList.remove('hidden'));
  $('btn-contact-mobile')?.addEventListener('click', () => {
    $('contact-modal').classList.remove('hidden');
    toggleHamburger();
  });

  $('btn-privacy-link')?.addEventListener('click', () => $('privacy-modal').classList.remove('hidden'));
  $('btn-terms-link')?.addEventListener('click', () => $('terms-modal').classList.remove('hidden'));

  $('btn-hamburger')?.addEventListener('click', toggleHamburger);
  $('drawer-backdrop')?.addEventListener('click', toggleHamburger);

  // --- Legal ---
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

  // --- Search & Filters ---
  $('search-input')?.addEventListener('input', debounce((e) => {
    AppState.searchQuery = e.target.value;
    refreshUI();
  }, 300));

  $('btn-clear-directory')?.addEventListener('click', () => {
    AppState.filters = { brand: null, era: null, politics: null, theories: null, gender: null, materials: null, geography: null, format: null, anatomy: null };
    AppState.searchQuery = '';
    AppState.activeVolumeId = null;
    if ($('search-input')) $('search-input').value = '';
    refreshUI();
  });

  $('btn-clear-volume-filter')?.addEventListener('click', () => {
    AppState.activeVolumeId = null;
    refreshUI();
  });

  // --- View Toggles ---
  $('btn-toggle-grid')?.addEventListener('click', () => switchView('grid', callbacks));
  $('btn-toggle-timeline')?.addEventListener('click', () => switchView('timeline', callbacks));

  // --- Auth Modal ---
  $('auth-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendSignInLink(callbacks);
  });

  // --- Volumes ---
  $('btn-create-volume')?.addEventListener('click', () => {
    const name = $('new-volume-name').value;
    if (name) createArchivalVolume(name, callbacks);
  });

  $('btn-export-all-volumes')?.addEventListener('click', exportAllVolumes);

  // --- Detail Actions ---
  $('btn-close-detail')?.addEventListener('click', () => closeDetail(callbacks, archiveData));
  $('btn-back-grid')?.addEventListener('click', () => closeDetail(callbacks, archiveData));
  $('btn-viewer-prev')?.addEventListener('click', () => navigateEntry(-1, archiveData, callbacks));
  $('btn-viewer-next')?.addEventListener('click', () => navigateEntry(1, archiveData, callbacks));
  
  $('btn-bookmark-entry')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) toggleBookmark(AppState.selectedEntryId, callbacks);
  });
  
  // --- Connection Matrix ---
  $('btn-open-matrix')?.addEventListener('click', () => {
    if (AppState.selectedEntryId) {
      openConnectionMatrix(AppState.selectedEntryId, archiveData, callbacks);
    }
  });

  $('btn-close-matrix')?.addEventListener('click', () => closeConnectionMatrix());
  $('matrix-backdrop')?.addEventListener('click', () => closeConnectionMatrix());

  $('btn-save-to-volume')?.addEventListener('click', () => {
    if (!currentUser) {
      showToast('Authentication required to save volumes.');
      toggleAuth();
      return;
    }
    $('save-volume-modal').classList.remove('hidden');
    renderSaveToVolumeModal();
  });

  $('btn-save-volume-mobile')?.addEventListener('click', () => {
    if (!currentUser) {
      showToast('Authentication required.');
      toggleAuth();
      return;
    }
    $('save-volume-modal').classList.remove('hidden');
    renderSaveToVolumeModal();
  });

  // --- Modal Backdrops ---
  document.querySelectorAll('[data-modal-backdrop]').forEach(el => {
    el.addEventListener('click', () => {
      const modal = el.closest('.fixed');
      if (modal) modal.classList.add('hidden');
    });
  });

  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modal = el.closest('.fixed');
      if (modal) modal.classList.add('hidden');
    });
  });

  // --- Sticky Notes ---
  document.querySelectorAll('.sticky-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const noteType = btn.dataset.note;
      const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
      if (entry) setStickyNote(noteType, entry);
    });
  });

  $('btn-close-sticky')?.addEventListener('click', () => {
    $('sticky-note-panel').classList.remove('active');
  });

  // --- Command Palette ---
  window.addEventListener('keydown', (e) => {
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

  // --- Cookie Banner ---
  if (!localStorage.getItem('lexicon-terms-accepted')) {
    $('cookie-banner')?.classList.remove('hidden');
  }
  $('btn-accept-cookies')?.addEventListener('click', () => {
    localStorage.setItem('lexicon-terms-accepted', 'true');
    $('cookie-banner')?.classList.add('hidden');
  });

  // --- Global Click Delegation ---
  document.addEventListener('click', (e) => {
    // Recent Entry Click
    const recentItem = e.target.closest('[data-recent-id]');
    if (recentItem) {
      openDetail(recentItem.dataset.recentId, 0, archiveData, callbacks);
      return;
    }

    // Taxonomy Item Click
    const taxItem = e.target.closest('.taxonomy-item');
    if (taxItem) {
      setActiveTaxonomy(taxItem.dataset.type);
      renderTaxonomySub(callbacks);
      return;
    }

    // Taxonomy Back Button
    if (e.target.closest('.btn-back-taxonomy')) {
      setActiveTaxonomy(null);
      refreshUI();
      return;
    }

    // Taxonomy Pill Click
    const taxPill = e.target.closest('.taxonomy-pill');
    if (taxPill) {
      const val = taxPill.dataset.value;
      const type = AppState.activeTaxonomy;
      if (AppState.filters[type] === val) {
        AppState.filters[type] = null;
      } else {
        AppState.filters[type] = val;
      }
      refreshUI();
      return;
    }
    
    // Close Mobile Dock
    if (e.target.id === 'btn-close-dock') {
      toggleMobileDock(false);
    }
    if (e.target.id === 'btn-lang-toggle' || e.target.id === 'btn-lang-toggle-mobile') {
      toggleLanguage();
    }
  });

  // Custom refresh event
  document.addEventListener('lexicon-refresh', refreshUI);
}

function toggleHamburger() {
  const panel = $('index-panel');
  const backdrop = $('drawer-backdrop');
  const btn = $('btn-hamburger');
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
  localStorage.setItem('lexicon-theme', isDark ? 'dark' : 'light');
  refreshUI();
}

function toggleLanguage() {
  let idx = supportedLanguages.indexOf(AppState.language);
  idx = (idx + 1) % supportedLanguages.length;
  AppState.language = supportedLanguages[idx];
  localStorage.setItem('lexicon-lang', AppState.language);
  refreshUI();
  showToast(`Terminal Language: ${AppState.language.toUpperCase()}`);
}

function renderVolumesView() {
  const container = $('volumes-grid');
  const countEl = $('volumes-count');
  if (!container) return;

  container.innerHTML = '';
  countEl.textContent = `${AppState.archivalVolumes.length} Volumes Initialized`;

  if (AppState.archivalVolumes.length === 0) {
    container.innerHTML = '<div class="col-span-full py-20 text-center opacity-40 font-mono text-xs uppercase tracking-widest">No Archival Volumes Detected.</div>';
    return;
  }

  AppState.archivalVolumes.forEach(vol => {
    const card = document.createElement('div');
    card.className = 'bg-bone dark:bg-darkBase border border-black dark:border-white p-6 cursor-crosshair hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-all group';
    card.innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-base font-bold font-mono uppercase tracking-wider">${vol.name}</h3>
        <button class="btn-export-vol text-[8px] border border-current px-2 py-0.5 opacity-0 group-hover:opacity-100" data-vol-id="${vol.id}">EXPORT_JSON</button>
      </div>
      ${vol.notes ? `<p class="text-[9px] font-mono opacity-60 mb-4 line-clamp-2 uppercase tracking-tight">${vol.notes}</p>` : `<p class="text-[9px] font-mono opacity-30 mb-4 uppercase tracking-widest italic">No observations logged.</p>`}
      <div class="flex justify-between items-end">
        <span class="text-[10px] font-mono opacity-60 uppercase">${vol.lookIds ? vol.lookIds.length : 0} Artifacts Audited</span>
        <span class="text-[9px] font-mono opacity-40 italic">${new Date(vol.createdAt).toLocaleDateString()}</span>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-export-vol')) {
        e.stopPropagation();
        exportVolume(vol.id);
        return;
      }
      AppState.activeVolumeId = vol.id;
      switchView('grid', callbacks);
      refreshUI();
      showToast(`Browsing ${vol.name}`);
    });
    container.appendChild(card);
  });
}

function renderSaveToVolumeModal() {
  const container = $('volume-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (AppState.archivalVolumes.length === 0) {
    container.innerHTML = '<p class="text-[10px] font-mono opacity-40 uppercase py-4">No existing volumes found.</p>';
    return;
  }

  AppState.archivalVolumes.forEach(vol => {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left border border-black/10 dark:border-white/10 p-3 text-[10px] font-mono uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-acid dark:hover:text-black transition-colors flex justify-between items-center';
    btn.innerHTML = `
      <span>${vol.name}</span>
      <span class="opacity-50">${vol.lookIds ? vol.lookIds.length : 0}</span>
    `;
    btn.addEventListener('click', () => {
      saveToVolume(vol.id, AppState.selectedEntryId, callbacks);
    });
    container.appendChild(btn);
  });
}

function exportVolume(volId) {
  const vol = AppState.archivalVolumes.find(v => v.id === volId);
  if (!vol) return;
  const entries = vol.lookIds.map(id => archiveData.find(e => e.id === id)).filter(Boolean);
  const data = {
    volume: vol.name,
    exportedAt: new Date().toISOString(),
    artifacts: entries
  };
  downloadJSON(data, `LEXICON_VOL_${vol.name}.json`);
}

function exportAllVolumes() {
  const data = {
    exportedAt: new Date().toISOString(),
    volumes: AppState.archivalVolumes
  };
  downloadJSON(data, `LEXICON_FULL_DATABASE_EXPORT.json`);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Expose for debugging
window.AppState = AppState;
