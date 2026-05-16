/**
 * connection-matrix.js
 * Logic for the artifact intersection matrix.
 */

import { $, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

export function openConnectionMatrix(entryId, archiveData, callbacks) {
  const entry = archiveData.find(e => e.id === entryId);
  if (!entry) return;

  const tagKeys = ['politics', 'theories', 'era', 'form', 'format', 'brand'];
  const connections = new Map();

  tagKeys.forEach(key => {
    const val = entry.tags[key];
    if (!val) return;
    const matches = archiveData.filter(e => e.id !== entryId && e.tags[key] === val);
    if (matches.length > 0) connections.set(val, { key, entries: matches });
  });

  const lang = AppState.language;
  const t = (k) => getTranslation(k, lang);

  let html = '';
  html += `<div class="matrix-center">
    <p class="text-[9px] uppercase tracking-[0.2em] opacity-40 mb-2">${t('nexus_viewing')}</p>
    <p class="text-base md:text-lg font-bold font-mono uppercase tracking-[0.1em]">${entry.tags.brand}</p>
    <p class="text-xs font-mono uppercase opacity-60 mt-1">${entry.year} &middot; ${entry.season}</p>
    <div class="mt-3">
      ${Object.entries(entry.tags).map(function(pair) { return '<span class="matrix-tag">' + t(pair[1]) + '</span>'; }).join('')}
    </div>
  </div>`;

  if (connections.size === 0) {
    html += `<div class="matrix-section"><p class="text-[10px] uppercase tracking-[0.15em] opacity-40 text-center py-8">${t('nexus_no_connections')}</p></div>`;
  } else {
    connections.forEach(function(data, tagValue) {
      html += '<div class="matrix-section">';
      html += `<p class="matrix-section-title">${t('nexus_shared')}: ${tagValue}</p>`;
      html += '<div class="matrix-entries">';
      data.entries.slice(0, 12).forEach(function(rel) {
        const thumbSrc = resolveImgSrc(rel.images && rel.images[0], rel.imageUrl);
        html += `<div class="matrix-entry" data-matrix-entry-id="${rel.id}">`;
        html += `<img src="${thumbSrc}" alt="${rel.tags.brand}" style="width:100%;aspect-ratio:3/4;object-fit:cover;margin-bottom:8px;filter:grayscale(70%) contrast(1.15);" loading="lazy" onerror="this.src='${BROKEN_ASSET}'; this.style.filter='none'" />`;
        html += `<p class="text-[10px] font-bold font-mono uppercase tracking-wide">${rel.tags.brand}</p>`;
        html += `<p class="text-[9px] font-mono uppercase opacity-50 mt-0.5">${rel.year}</p>`;
        html += '</div>';
      });
      html += '</div></div>';
    });
  }

  const content = $('matrix-content');
  if (content) {
    content.innerHTML = html;
    if (!content._matrixClickBound) {
      content._matrixClickBound = true;
      content.addEventListener('click', function(e) {
        const el = e.target.closest('.matrix-entry');
        if (el && callbacks && callbacks.openDetail) {
          closeConnectionMatrix();
          callbacks.openDetail(el.dataset.matrixEntryId);
        }
      });
    }
  }
  const matrix = $('connection-matrix');
  if (matrix) {
    matrix.classList.remove('hidden');
    matrix.classList.add('open');
  }
  document.body.style.overflow = 'hidden';
}

export function closeConnectionMatrix() {
  const matrix = $('connection-matrix');
  if (matrix) {
    matrix.classList.remove('open');
    matrix.classList.add('hidden');
  }
  document.body.style.overflow = '';
}
