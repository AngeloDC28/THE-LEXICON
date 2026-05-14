/**
 * navigation.js
 * Logic for view switching and tab management.
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';

export function switchView(viewId, callbacks) {
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

  // Views mapping
  const views = ['grid-view', 'volumes-view', 'timeline-view'];
  views.forEach(v => {
    const el = $(v);
    if (el) {
      if (v === `${viewId}-view`) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Sidebar Visibility (Directory)
  const directory = $('directory-sidebar');
  if (directory) {
    if (viewId === 'grid') {
      directory.classList.remove('hidden');
    } else {
      directory.classList.add('hidden');
    }
  }

  // Header Title State
  const headerTitle = $('header-title');
  if (headerTitle) {
    if (viewId === 'volumes') {
      headerTitle.innerHTML = 'LEXICON / VOLUMES';
    } else if (viewId === 'timeline') {
      headerTitle.innerHTML = 'LEXICON / CHRONOLOGY';
    } else {
      headerTitle.innerHTML = 'THE LEXICON';
    }
  }

  // Update Navigation Active States
  updateNavStates(viewId);

  // View Specific Logic
  if (viewId === 'volumes' && callbacks?.renderVolumes) {
    callbacks.renderVolumes();
  }

  if (callbacks?.onUpdate) callbacks.onUpdate();
}

function updateNavStates(viewId) {
  // Grid Button
  const btnGrid = $('btn-toggle-grid');
  if (btnGrid) {
    if (viewId === 'grid') {
      btnGrid.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    } else {
      btnGrid.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    }
  }

  // Timeline Button
  const btnTimeline = $('btn-toggle-timeline');
  if (btnTimeline) {
    if (viewId === 'timeline') {
      btnTimeline.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    } else {
      btnTimeline.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    }
  }

  // Volumes Button (Header)
  const btnVolumes = $('btn-volumes-toggle');
  if (btnVolumes) {
    if (viewId === 'volumes') {
      btnVolumes.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    } else {
      btnVolumes.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
    }
  }
}
