/**
 * connection-matrix.js
 * Nexus connections panel with force-directed graph and list views.
 */

import { $, resolveImgSrc, BROKEN_ASSET } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

// Track active simulation cleanup across re-opens
let _cancelSim = null;
let _currentView = 'graph'; // 'graph' | 'list'
let _lastEntry = null;
let _lastConnections = null;
let _lastCallbacks = null;

export function openConnectionMatrix(entryId, archiveData, callbacks) {
  const entry = archiveData.find(e => e.id === entryId);
  if (!entry) return;

  const tagKeys = ['politics', 'theories', 'era', 'format', 'brand', 'materials', 'geography', 'anatomy'];
  const connections = new Map();

  tagKeys.forEach(key => {
    const val = entry.tags[key];
    if (!val) return;
    const matches = archiveData.filter(e => e.id !== entryId && e.tags[key] === val);
    if (matches.length > 0) connections.set(val, { key, entries: matches });
  });

  _lastEntry = entry;
  _lastConnections = connections;
  _lastCallbacks = callbacks;

  const matrix = $('connection-matrix');
  if (matrix) {
    matrix.classList.remove('hidden');
    matrix.classList.add('open');
  }
  document.body.style.overflow = 'hidden';

  // Bind tab switching
  const tabGraph = $('nexus-tab-graph');
  const tabList  = $('nexus-tab-list');
  if (tabGraph && !tabGraph._nexusBound) {
    tabGraph._nexusBound = true;
    tabGraph.addEventListener('click', () => setNexusView('graph'));
    tabList.addEventListener('click',  () => setNexusView('list'));
  }

  setNexusView(_currentView, true);
}

function setNexusView(view, force = false) {
  if (view === _currentView && !force) return;
  _currentView = view;

  // Update tab aria states
  const tabGraph = $('nexus-tab-graph');
  const tabList  = $('nexus-tab-list');
  if (tabGraph && tabList) {
    const activeClass = ['border-white/30', 'bg-white/10', 'text-white'];
    const inactiveClass = ['border-white/10', 'text-white/40'];
    if (view === 'graph') {
      activeClass.forEach(c => tabGraph.classList.add(c));
      inactiveClass.forEach(c => { tabGraph.classList.remove(c); tabList.classList.add(c); tabList.classList.remove(...activeClass); });
      tabGraph.setAttribute('aria-selected', 'true');
      tabList.setAttribute('aria-selected', 'false');
    } else {
      activeClass.forEach(c => tabList.classList.add(c));
      inactiveClass.forEach(c => { tabList.classList.remove(c); tabGraph.classList.add(c); tabGraph.classList.remove(...activeClass); });
      tabList.setAttribute('aria-selected', 'true');
      tabGraph.setAttribute('aria-selected', 'false');
    }
  }

  if (_cancelSim) { _cancelSim(); _cancelSim = null; }

  const content = $('matrix-content');
  if (!content || !_lastEntry) return;

  if (view === 'graph') {
    renderGraph(_lastEntry, _lastConnections, _lastCallbacks, content);
  } else {
    renderList(_lastEntry, _lastConnections, _lastCallbacks, content);
  }
}

// ── GRAPH VIEW ───────────────────────────────────────────────────────────────

function renderGraph(entry, connections, callbacks, container) {
  container.innerHTML = '';
  container.style.overflow = 'hidden';

  const W = container.clientWidth  || 700;
  const H = container.clientHeight || 500;

  // Build node + link structures
  const nodes = [];
  const nodeMap = new Map();
  const links  = [];

  const anchor = {
    id: entry.id,
    brand: (entry.tags?.brand || entry.id).toUpperCase(),
    year: entry.year || '',
    isCurrent: true,
    x: W / 2, y: H / 2,
    vx: 0, vy: 0,
    degree: 0,
  };
  nodes.push(anchor);
  nodeMap.set(entry.id, anchor);

  // Tag category → colour for link colouring
  const TAG_COLORS = {
    politics:  '#FF6B6B', theories: '#FFB347', era: '#87CEEB',
    format:    '#DDA0DD', brand:    '#98FB98', materials: '#F0E68C',
    geography: '#87CEFA', anatomy: '#FFB6C1',
  };

  connections.forEach(({ key, entries: relEntries }, tagValue) => {
    relEntries.slice(0, 10).forEach(rel => {
      if (!nodeMap.has(rel.id)) {
        const angle = Math.random() * 2 * Math.PI;
        const r = 100 + Math.random() * 120;
        const node = {
          id: rel.id,
          brand: (rel.tags?.brand || rel.id).toUpperCase(),
          year: rel.year || '',
          isCurrent: false,
          x: W / 2 + Math.cos(angle) * r,
          y: H / 2 + Math.sin(angle) * r,
          vx: 0, vy: 0, degree: 0,
        };
        nodes.push(node);
        nodeMap.set(rel.id, node);
      }
      const src = nodeMap.get(entry.id);
      const tgt = nodeMap.get(rel.id);
      src.degree++;
      tgt.degree++;
      links.push({ source: src, target: tgt, key, color: TAG_COLORS[key] || '#ffffff' });
    });
  });

  // SVG
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-label', 'Nexus connection graph');
  svg.style.cssText = 'width:100%;height:100%;display:block;';

  // Link elements — rendered first so nodes appear on top
  const linkEls = links.map(({ source, target, color }) => {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-opacity', '0.25');
    svg.appendChild(line);
    return line;
  });

  // Node groups
  const nodeEls = nodes.map(node => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${node.brand} ${node.year}`);

    const radius = node.isCurrent ? 16 : Math.max(5, 5 + node.degree * 1.2);
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', node.isCurrent ? '#CCFF00' : 'rgba(255,255,255,0.85)');
    circle.setAttribute('stroke', node.isCurrent ? '#CCFF00' : 'rgba(255,255,255,0.2)');
    circle.setAttribute('stroke-width', node.isCurrent ? '3' : '1');
    g.appendChild(circle);

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dy', `${radius + 10}px`);
    label.setAttribute('fill', node.isCurrent ? '#CCFF00' : 'rgba(255,255,255,0.5)');
    label.setAttribute('font-size', '7');
    label.setAttribute('font-family', 'ui-monospace,monospace');
    label.setAttribute('pointer-events', 'none');
    label.textContent = node.brand.slice(0, 14);
    g.appendChild(label);

    if (!node.isCurrent) {
      g.style.cursor = 'pointer';
      const openEntry = () => {
        if (callbacks?.openDetail) {
          closeConnectionMatrix();
          callbacks.openDetail(node.id);
        }
      };
      g.addEventListener('click', openEntry);
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEntry(); }
      });
      // Hover highlight
      g.addEventListener('mouseenter', () => {
        circle.setAttribute('fill', '#CCFF00');
        label.setAttribute('fill', '#CCFF00');
      });
      g.addEventListener('mouseleave', () => {
        circle.setAttribute('fill', 'rgba(255,255,255,0.85)');
        label.setAttribute('fill', 'rgba(255,255,255,0.5)');
      });
    }

    svg.appendChild(g);
    return { g, node, radius };
  });

  container.appendChild(svg);

  // ── Vanilla force simulation ──────────────────────────────────────────────
  const REPULSION    = 3000;
  const LINK_DIST    = 110;
  const LINK_STR     = 0.04;
  const CENTER_STR   = 0.015;
  const DAMPING      = 0.72;
  const MARGIN       = 30;
  let   frame        = null;
  let   tick         = 0;
  const MAX_TICKS    = 250;

  function simulate() {
    tick++;

    // Repulsion between every pair
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy || 1;
        const d  = Math.sqrt(d2);
        const f  = REPULSION / d2;
        const fx = dx / d * f;
        const fy = dy / d * f;
        if (!a.isCurrent) { a.vx -= fx; a.vy -= fy; }
        if (!b.isCurrent) { b.vx += fx; b.vy += fy; }
      }
    }

    // Link attraction
    links.forEach(({ source: a, target: b }) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d  = Math.sqrt(dx * dx + dy * dy) || 1;
      const delta = (d - LINK_DIST) * LINK_STR;
      const fx = dx / d * delta;
      const fy = dy / d * delta;
      if (!a.isCurrent) { a.vx += fx; a.vy += fy; }
      if (!b.isCurrent) { b.vx -= fx; b.vy -= fy; }
    });

    // Centre + damping + bounds
    const coolingFactor = Math.max(0.3, 1 - tick / MAX_TICKS);
    nodes.forEach(n => {
      if (n.isCurrent) return;
      n.vx += (W / 2 - n.x) * CENTER_STR * coolingFactor;
      n.vy += (H / 2 - n.y) * CENTER_STR * coolingFactor;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x = Math.max(MARGIN, Math.min(W - MARGIN, n.x + n.vx));
      n.y = Math.max(MARGIN, Math.min(H - MARGIN, n.y + n.vy));
    });

    // Update DOM
    linkEls.forEach((line, i) => {
      const { source, target } = links[i];
      line.setAttribute('x1', source.x);
      line.setAttribute('y1', source.y);
      line.setAttribute('x2', target.x);
      line.setAttribute('y2', target.y);
    });
    nodeEls.forEach(({ g, node }) => {
      g.setAttribute('transform', `translate(${node.x},${node.y})`);
    });

    if (tick < MAX_TICKS) {
      frame = requestAnimationFrame(simulate);
    }
  }

  frame = requestAnimationFrame(simulate);
  _cancelSim = () => { if (frame) cancelAnimationFrame(frame); };

  // Empty state
  if (connections.size === 0) {
    container.innerHTML = '';
    container.style.overflow = '';
    const lang = AppState.language;
    container.innerHTML = `<div class="matrix-section"><p class="text-[var(--t-mono-xs)] uppercase tracking-[0.15em] opacity-40 text-center py-8">${getTranslation('nexus_no_connections', lang)}</p></div>`;
  }
}

// ── LIST VIEW ─────────────────────────────────────────────────────────────────

function renderList(entry, connections, callbacks, container) {
  if (_cancelSim) { _cancelSim(); _cancelSim = null; }
  container.innerHTML = '';
  container.style.overflow = 'auto';

  const lang = AppState.language;
  const t = k => getTranslation(k, lang);

  let html = `<div class="matrix-center">
    <p class="text-[var(--t-mono-xs)] uppercase tracking-[0.2em] opacity-40 mb-2">${t('nexus_viewing')}</p>
    <p class="text-base md:text-lg font-bold font-mono uppercase tracking-[0.1em]">${entry.tags.brand}</p>
    <p class="text-xs font-mono uppercase opacity-60 mt-1">${entry.year} &middot; ${entry.season}</p>
    <div class="mt-3">
      ${Object.entries(entry.tags).map(([, v]) => v ? `<span class="matrix-tag">${t(v)}</span>` : '').join('')}
    </div>
  </div>`;

  if (connections.size === 0) {
    html += `<div class="matrix-section"><p class="text-[var(--t-mono-xs)] uppercase tracking-[0.15em] opacity-40 text-center py-8">${t('nexus_no_connections')}</p></div>`;
  } else {
    connections.forEach(({ key, entries: relEntries }, tagValue) => {
      html += '<div class="matrix-section">';
      html += `<p class="matrix-section-title">${t('nexus_shared')}: ${tagValue}</p>`;
      html += '<div class="matrix-entries">';
      relEntries.slice(0, 12).forEach(rel => {
        const thumbSrc = resolveImgSrc(rel.images?.[0]);
        const label = `${rel.tags.brand || ''} ${rel.year || ''}`;
        html += `<button type="button" class="matrix-entry focus-ring" data-matrix-entry-id="${rel.id}" aria-label="Open ${label}">
          <img src="${thumbSrc}" alt="" style="width:100%;aspect-ratio:3/4;object-fit:cover;margin-bottom:8px;" loading="lazy" onerror="this.onerror=null;this.src='${BROKEN_ASSET}';this.style.filter='none'" />
          <p class="text-[var(--t-mono-xs)] font-bold font-mono uppercase tracking-wide">${rel.tags.brand}</p>
          <p class="text-[var(--t-mono-xs)] font-mono uppercase opacity-50 mt-0.5">${rel.year}</p>
        </button>`;
      });
      html += '</div></div>';
    });
  }

  container.innerHTML = html;

  container.addEventListener('click', e => {
    const el = e.target.closest('.matrix-entry');
    if (el && callbacks?.openDetail) {
      closeConnectionMatrix();
      callbacks.openDetail(el.dataset.matrixEntryId);
    }
  }, { once: true });
}

// ── CLOSE ─────────────────────────────────────────────────────────────────────

export function closeConnectionMatrix() {
  if (_cancelSim) { _cancelSim(); _cancelSim = null; }
  const matrix = $('connection-matrix');
  if (matrix) {
    matrix.classList.remove('open');
    matrix.classList.add('hidden');
  }
  document.body.style.overflow = '';
}
