/**
 * telemetry.js
 * The one-line status text in the header.
 *
 * This used to be a typewriter cycling through a dozen in-joke lines
 * ("INTERCEPTING ANTI-CONSUMERIST SIGNALS", …) and stamping an ACTION_LOG
 * line on every entry open. It wore thin after the first visit, and because
 * it rewrote the header text every 25–45ms it also kept the page translator's
 * MutationObserver busy for the whole session. It now shows one fixed,
 * factual line built from the archive itself.
 */

import { $ } from './core-utils.js?v=d58e597';

export function initHeaderTypewriter(archiveData) {
  const textEl = $('telemetry-text');
  if (!textEl || !archiveData || !archiveData.length) return;
  // One brand per show, so "45 ENTRIES · 45 BRANDS" read like a placeholder.
  const years = archiveData.map(e => e.year).filter(Boolean);
  textEl.textContent = `${archiveData.length} SHOWS · ${Math.min(...years)}–${Math.max(...years)}`;
}

