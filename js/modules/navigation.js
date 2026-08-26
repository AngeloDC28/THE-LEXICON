import { $, withViewTransition } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

const _scrollPositions = {};

export function switchView(viewId, callbacks) {
  // Save scroll position of the current view before switching
  const currentViewEl = $(`${AppState.currentView}-view`);
  if (currentViewEl) _scrollPositions[AppState.currentView] = currentViewEl.scrollTop;

  // If we are in detail view, we might want to close it first if switching to a primary view
  // But usually detail view overlays, so we only hide it if we explicitly go to a primary view
  if (viewId !== 'detail') {
    const detail = $('detail-image-view');
    if (detail && !detail.classList.contains('hidden')) {
      if (callbacks && callbacks.closeDetail) {
        callbacks.closeDetail();
      }
    }
  }

  AppState.currentView = viewId;

  withViewTransition(() => {
    // Views mapping
    const views = ['grid-view', 'folders-view', 'timeline-view'];
    views.forEach(v => {
      const el = $(v);
      if (el) {
        if (v === `${viewId}-view`) {
          el.classList.remove('hidden');
          // Restore scroll position
          const saved = _scrollPositions[viewId];
          if (saved !== undefined) requestAnimationFrame(() => { el.scrollTop = saved; });
        } else {
          el.classList.add('hidden');
        }
      }
    });

    // Sidebar Visibility (Directory)
    const directory = $('index-panel');
    if (directory) {
      // Only hide sidebar if explicitly not in grid view AND on mobile
      if (viewId === 'grid' || window.innerWidth >= 1024) {
        directory.classList.remove('hidden');
      } else {
        directory.classList.add('hidden');
      }
    }

    // Callbacks to re-render active states
    if (callbacks) {
      if (callbacks.updateNavStates) callbacks.updateNavStates();
      if (callbacks.updateStatusBar) callbacks.updateStatusBar();
    }
  });

  // Header Title State
  const headerTitle = $('header-title');
  if (headerTitle) {
    const t = (key) => getTranslation(key, AppState.language);
    
    if (viewId === 'folders') {
      headerTitle.innerHTML = `LEXICON / ${t('nav_folders_mobile').toUpperCase()}`;
    } else if (viewId === 'timeline') {
      headerTitle.innerHTML = `LEXICON / ${t('view_timeline').toUpperCase()}`;
    } else {
      headerTitle.innerHTML = 'THE LEXICON';
    }
  }

  // Update Navigation Active States
  updateNavStates(viewId);

  // View Specific Logic
  if (viewId === 'folders' && callbacks?.renderFolders) {
    callbacks.renderFolders();
  }

  // Footer visibility — show only on grid view
  const footer = document.getElementById('site-footer');
  if (footer) footer.classList.toggle('hidden', viewId !== 'grid');

  if (callbacks?.onUpdate) callbacks.onUpdate();
}

function updateNavStates(viewId) {
  const setActive = (btn, isActive) => {
    if (!btn) return;
    btn.classList.toggle('opacity-100', isActive);
    btn.classList.toggle('opacity-40', !isActive);
    btn.classList.toggle('view-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  };
  setActive($('btn-toggle-grid'),     viewId === 'grid');
  setActive($('btn-toggle-timeline'), viewId === 'timeline');
  setActive($('btn-folders-toggle'),  viewId === 'folders');

  // Dynamic current-view label
  const label = $('current-view-label');
  if (label) {
    const t = (key) => getTranslation(key, AppState.language);
    const map = { grid: 'view_grid', timeline: 'view_timeline', folders: 'folders_title' };
    label.textContent = t(map[viewId] || 'view_grid').toUpperCase();
  }
}
