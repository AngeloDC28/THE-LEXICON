/**
 * glossary.js
 * Hover/tap tooltips for glossary terms in entry content, and the glossary
 * modal. The definitions live in glossary-data.js (no DOM), which the build
 * also imports to write the /glossary page.
 */

import { GLOSSARY, FASHION_BASICS } from './glossary-data.js?v=3652186';
export { GLOSSARY, FASHION_BASICS };

// ─── Tooltip Engine ──────────────────────────────────────────────────────────

let _activeTooltip = null;

/** Anchor id used on the /glossary page: "body politics" → "body-politics". */
export function glossaryAnchor(term) {
  return term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createTooltip(term, def) {
  const div = document.createElement('div');
  div.className = 'gloss-tooltip';
  div.setAttribute('role', 'tooltip');
  div.innerHTML = `<strong class="gloss-tooltip-term">${term}</strong><p class="gloss-tooltip-def">${def}</p><a class="gloss-tooltip-more" href="/glossary#${glossaryAnchor(term)}">Full glossary →</a>`;
  return div;
}

function positionTooltip(el, tooltip) {
  document.body.appendChild(tooltip);
  const r = el.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let left = r.left + window.scrollX;
  let top  = r.bottom + window.scrollY + 6;
  if (left + tw > window.innerWidth - 12) left = window.innerWidth - tw - 12;
  if (top + th > window.innerHeight + window.scrollY - 12) top = r.top + window.scrollY - th - 6;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top  = `${top}px`;
}

function dismissTooltip() {
  if (_activeTooltip) { _activeTooltip.remove(); _activeTooltip = null; }
}

// ─── DOM marking ─────────────────────────────────────────────────────────────

const _termRe = new Map();

function getTermRegex(term) {
  if (!_termRe.has(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    _termRe.set(term, new RegExp(`\\b(${escaped})\\b`, 'gi'));
  }
  return _termRe.get(term);
}

export function initGlossaryTooltips(container) {
  if (!container) return;
  const terms = Object.keys(GLOSSARY).filter(t => t.length >= 6).sort((a, b) => b.length - a.length);

  function walkTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      for (const term of terms) {
        const re = getTermRegex(term);
        re.lastIndex = 0;
        if (re.test(text)) {
          const span = document.createElement('span');
          re.lastIndex = 0;
          span.innerHTML = text.replace(re, `<span class="gloss-term" data-term="${term}" tabindex="0" role="button" aria-label="${term}: tap for definition">$1</span>`);
          node.parentNode.replaceChild(span, node);
          return;
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE &&
               !['SCRIPT','STYLE','A','BUTTON','INPUT'].includes(node.tagName) &&
               !node.classList.contains('gloss-term') &&
               !node.classList.contains('gloss-tooltip')) {
      Array.from(node.childNodes).forEach(walkTextNodes);
    }
  }

  walkTextNodes(container);

  container.addEventListener('click', (e) => {
    const target = e.target.closest('.gloss-term');
    if (!target) { dismissTooltip(); return; }
    e.stopPropagation();
    dismissTooltip();
    const term = target.dataset.term;
    const def  = GLOSSARY[term];
    if (!def) return;
    _activeTooltip = createTooltip(term, def);
    positionTooltip(target, _activeTooltip);
  });

  container.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('gloss-term')) {
      e.preventDefault();
      e.target.click();
    }
  });
}

document.addEventListener('click', (e) => {
  if (_activeTooltip && !e.target.closest('.gloss-tooltip') && !e.target.closest('.gloss-term')) {
    dismissTooltip();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _activeTooltip) {
    // Consume the keypress so the global handler doesn't also close the
    // surface beneath the tooltip (detail view, modal, etc.).
    e.preventDefault();
    dismissTooltip();
  }
});

// ─── Glossary Modal ───────────────────────────────────────────────────────────

export function renderGlossaryModal() {
  const container = document.getElementById('glossary-terms');
  if (!container) return;
  const row = ([term, def]) => `
    <div class="glossary-entry">
      <dt class="glossary-term">${term}</dt>
      <dd class="glossary-def">${def}</dd>
    </div>`;
  const sorted = (o) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
  container.innerHTML =
    `<div class="glossary-group">Fashion basics</div>${sorted(FASHION_BASICS).map(row).join('')}` +
    `<div class="glossary-group">Ideas and theory</div>${sorted(GLOSSARY).map(row).join('')}`;
}
