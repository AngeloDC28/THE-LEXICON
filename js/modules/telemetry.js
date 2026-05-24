/**
 * telemetry.js
 * Logic for the telemetry system and typewriter effect.
 */

import { $ } from './core-utils.js';

export const telemetryLogs = [
  'INITIALIZING ARCHIVE_v7.2.5...',
  'ESTABLISHING HANDSHAKE WITH CLOUD_RUN...',
  'AUDITING SOCIO-POLITICAL METADATA...',
  'PARSING DECONSTRUCTIONIST INDEX...',
  'MAPPING RELATIONAL NODE NETWORKS...',
  'INDEXING FASHION REPOSITORY...',
  'BUFFERING ARCHIVAL VISUALS...',
  'TERMINAL_ACCESS: GRANTED',
  'READY_FOR_INPUT.'
];

let logIndex = 0;

export function updateTelemetry(manualLog = null) {
  const telText = $('telemetry-text');
  if (!telText) return;
  
  let base;
  if (manualLog) {
    base = manualLog;
  } else {
    base = telemetryLogs[logIndex % telemetryLogs.length];
    logIndex++;
  }
  
  const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  telText.textContent = `[${timestamp}] ${base}`;
  
  // Removed periodic update to avoid conflict with typewriter
  // if (!manualLog) {
  //   setTimeout(() => updateTelemetry(), 4000 + Math.random() * 3000);
  // }
}

export function updateHeaderTelemetry(text) {
  updateTelemetry(`ACTION_LOG: ${text.toUpperCase()}`);
}

export function initHeaderTypewriter(archiveData) {
  // Build a live count phrase from the actual archive if provided
  const statsPhrase = (() => {
    if (!archiveData || !archiveData.length) return null;
    const entryCount = archiveData.length;
    const brandSet = new Set(archiveData.map(e => e.tags?.brand).filter(Boolean));
    const lastYear = Math.max(...archiveData.map(e => e.year || 0).filter(Boolean));
    return `${entryCount} ENTRIES · ${brandSet.size} BRANDS · THROUGH ${lastYear}`;
  })();

  const phrases = [
    ...(statsPhrase ? [statsPhrase] : []),
    'ROUTING SEMIOTIC SABOTAGE',
    'ISOLATING CLASS DYNAMICS',
    'DECODING STRUCTURAL POWER MECHANICS',
    'MAPPING SUBCULTURAL RESISTANCE THEORY',
    'PARSING DECONSTRUCTIONIST LOGICS',
    'INDEXING AVANT-GARDE ARCHIVE',
    'TRACING DIASPORIC NARRATIVES',
    'AUDITING BODILY AUTONOMY PROTOCOLS',
    'SCANNING SIMULACRAL ARCHITECTURES',
    'COMPILING FORENSIC CRITIQUE DATA',
    'INTERCEPTING ANTI-CONSUMERIST SIGNALS',
    'CALIBRATING POST-BINARY FORM ANALYSIS',
    'ISOLATING RADICAL CORPOREAL INTERVENTIONS',
  ];

  let currentPhrase = 0;
  let charIndex = 0;
  let isDeleting = false;
  const typeSpeed = 45;
  const deleteSpeed = 25;
  const pauseAfterType = 2200;
  const pauseAfterDelete = 350;

  function tick() {
    const textEl = $('telemetry-text');
    if (!textEl) return;

    const phrase = phrases[currentPhrase];

    if (!isDeleting) {
      charIndex++;
      textEl.textContent = phrase.substring(0, charIndex);

      if (charIndex >= phrase.length) {
        setTimeout(function () {
          isDeleting = true;
          tick();
        }, pauseAfterType);
        return;
      }
      setTimeout(tick, typeSpeed);
    } else {
      charIndex--;
      textEl.textContent = phrase.substring(0, charIndex);

      if (charIndex <= 0) {
        isDeleting = false;
        currentPhrase = (currentPhrase + 1) % phrases.length;
        setTimeout(tick, pauseAfterDelete);
        return;
      }
      setTimeout(tick, deleteSpeed);
    }
  }

  setTimeout(tick, 1700);
}
