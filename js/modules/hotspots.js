/**
 * hotspots.js
 * Owns all hotspot click interactions: desktop floating payload + mobile bottom sheet.
 *
 * Click events are handled here via a single delegated listener on #detail-image-view.
 * render-detail.js keeps only mouseenter/mouseleave for the desktop hover preview.
 */
import { $, escapeHtml } from './core-utils.js?v=3652186';
import { AppState } from './core-state.js?v=3652186';
import { getTranslation } from './translations.js?v=3652186';

let _archiveData = [];
let _triggerBtn = null;

export function initHotspotInteractions(archiveData) {
  if (Array.isArray(archiveData)) _archiveData = archiveData;

  const detailView = $('detail-image-view');
  if (!detailView) return;

  detailView.addEventListener('click', (e) => {
    const btn = e.target.closest('.hotspot-btn');
    if (btn) {
      e.stopPropagation();
      _triggerBtn = btn;
      const idx = parseInt(btn.dataset.index, 10);
      toggleHotspot(idx);
    }
  });

  const closeSheetBtn = $('btn-close-hotspot-sheet');
  if (closeSheetBtn) {
    closeSheetBtn.addEventListener('click', () => cleanupHotspots());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && AppState.activeHotspot !== null) {
      e.preventDefault();
      cleanupHotspots();
    }
  });
}

export function toggleHotspot(index) {
  if (AppState.activeHotspot === index) {
    cleanupHotspots();
  } else {
    showHotspot(index);
  }
}

function showHotspot(index) {
  AppState.activeHotspot = index;

  const entry = _archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  const imgs = entry.images || [{ src: entry.imageUrl }];
  const hotspots = imgs[AppState.currentImageIndex]?.hotspots || entry.hotspots || [];
  const spot = hotspots[index];
  if (!spot) return;

  let text = spot.description || '';
  text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();

  if (window.innerWidth < 1024) {
    // Mobile: slide-up bottom sheet with scrollable, readable text
    const sheet = $('mobile-hotspot-sheet');
    const labelEl = $('mobile-hotspot-sheet-label');
    const bodyEl = $('mobile-hotspot-sheet-body');
    if (sheet && labelEl && bodyEl) {
      labelEl.textContent = String(spot.label || '').toUpperCase();
      bodyEl.textContent = text;
      sheet.setAttribute('aria-hidden', 'false');
      sheet.classList.add('open');
      // Move focus to close button so keyboard users can dismiss the sheet
      const closeBtn = $('btn-close-hotspot-sheet');
      if (closeBtn) requestAnimationFrame(() => closeBtn.focus());
    }
  } else {
    // Desktop: permanent floating payload
    const payload = $('analytical-payload');
    const content = $('payload-content');
    if (payload && content) {
      content.innerHTML = `
        <div class="t-mono-xs font-bold mb-2 border-b border-black/10 pb-1">${escapeHtml(String(spot.label || '').toUpperCase())}</div>
        <div class="t-mono-xs leading-relaxed">${escapeHtml(text)}</div>
      `;
      payload.classList.remove('hidden');
      payload.classList.add('permanent-payload', 'expand-active');
      payload.onclick = (e) => {
        e.stopPropagation();
        cleanupHotspots();
      };
      placePayload(document.querySelector(`.hotspot-btn[data-index="${index}"]`));
    }
  }

  document.querySelectorAll('.hotspot-btn').forEach((btn) => {
    if (parseInt(btn.dataset.index, 10) === index) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

export function cleanupHotspots() {
  const prevTrigger = _triggerBtn;
  _triggerBtn = null;
  AppState.activeHotspot = null;
  document.querySelectorAll('.hotspot-btn').forEach(btn => btn.classList.remove('active'));

  const sheet = $('mobile-hotspot-sheet');
  if (sheet) {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    // Return focus to the hotspot button that opened the sheet
    if (prevTrigger) requestAnimationFrame(() => prevTrigger.focus());
  }

  const payload = $('analytical-payload');
  if (payload) {
    payload.classList.remove('permanent-payload', 'expand-active');
    payload.classList.add('hidden');
  }
  hidePayloadLeader();
}

/**
 * placePayload — put the annotation card in the empty space beside the
 * image, never on the image itself, and draw a leader line from the hotspot
 * to it (the way a museum label points at a detail).
 *
 * The card used to sit over the bottom-left corner of the photograph,
 * covering part of the look being annotated. Now it goes in whichever
 * gutter of the image stage is on the hotspot's side; if that gutter is too
 * narrow it tries the other one; and if the window leaves no gutter at all
 * it sits over the notes column instead — still off the image.
 */
const PAYLOAD_MIN_W = 220;
const PAYLOAD_MAX_W = 340;
const GUTTER_INSET = 56; // keeps clear of the prev/next image arrows

export function placePayload(btn) {
  const payload = $('analytical-payload');
  const sector = $('detail-image-sector');
  const wrapper = $('detail-image-wrapper');
  if (!payload || !sector || !wrapper || !btn) return;
  if (window.innerWidth < 1024) return; // mobile uses the bottom sheet

  // Live in the stage, not inside the image wrapper.
  if (payload.parentElement !== sector) sector.appendChild(payload);
  payload.classList.add('payload-docked');

  const s = sector.getBoundingClientRect();
  const img = wrapper.getBoundingClientRect();
  const hot = btn.getBoundingClientRect();
  const hx = hot.left + hot.width / 2;
  const hy = hot.top + hot.height / 2;

  const leftGutter = img.left - s.left - GUTTER_INSET - 16;
  const rightGutter = s.right - img.right - GUTTER_INSET - 16;
  const preferLeft = hx < img.left + img.width / 2;
  const order = preferLeft ? ['left', 'right'] : ['right', 'left'];
  let side = order.find(sd => (sd === 'left' ? leftGutter : rightGutter) >= PAYLOAD_MIN_W) || null;

  let width, left;
  if (side) {
    width = Math.min(PAYLOAD_MAX_W, side === 'left' ? leftGutter : rightGutter);
    left = side === 'left' ? img.left - 16 - width : img.right + 16;
  } else {
    // No usable gutter: sit over the notes column, just past the stage.
    const sidebar = $('detail-metadata-sidebar');
    const sb = sidebar ? sidebar.getBoundingClientRect() : null;
    side = 'sidebar';
    width = sb ? Math.min(PAYLOAD_MAX_W, sb.width - 32) : PAYLOAD_MIN_W;
    left = sb ? sb.left + 16 : s.right - width - 16;
  }

  payload.style.width = width + 'px';
  payload.style.maxWidth = width + 'px';
  // Measure at the final width, then centre on the hotspot and clamp.
  const h = payload.offsetHeight;
  const top = Math.max(s.top + 12, Math.min(hy - h / 2, s.bottom - h - 12));
  payload.style.left = (left - s.left) + 'px';
  payload.style.top = (top - s.top) + 'px';

  // Leader line from the hotspot to the card's near edge.
  let leader = $('payload-leader');
  if (!leader) {
    leader = document.createElement('div');
    leader.id = 'payload-leader';
    leader.setAttribute('aria-hidden', 'true');
    sector.appendChild(leader);
  }
  const cardOnLeft = left + width / 2 < hx;
  const ex = cardOnLeft ? left + width : left;
  const ey = Math.max(top + 16, Math.min(hy, top + h - 16));
  const dx = ex - hx, dy = ey - hy;
  leader.style.left = (hx - s.left) + 'px';
  leader.style.top = (hy - s.top) + 'px';
  leader.style.width = Math.hypot(dx, dy) + 'px';
  leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  leader.classList.add('visible');
}

export function hidePayloadLeader() {
  $('payload-leader')?.classList.remove('visible');
}

// A resize moves the image and its gutters: re-dock the open card (once per
// frame) so it follows the hotspot instead of closing on the reader.
let _resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(() => {
    const payload = $('analytical-payload');
    if (!payload || payload.classList.contains('hidden')) { hidePayloadLeader(); return; }
    const btn = AppState.activeHotspot !== null
      ? document.querySelector(`.hotspot-btn[data-index="${AppState.activeHotspot}"]`)
      : null;
    if (btn && window.innerWidth >= 1024) placePayload(btn);
    else hidePayloadLeader();
  });
});

export function toggleMobileHotspots() {
  const btn = $('btn-toggle-hotspots-mobile');
  const detail = $('detail-image-view');
  if (!detail) return;
  const isVisible = detail.classList.contains('show-hotspots');
  detail.classList.toggle('show-hotspots', !isVisible);
  if (isVisible) cleanupHotspots();
  // The button is an icon span + a .btn-label-mobile span. Writing
  // textContent on the button itself wiped both and left a long
  // "HOTSPOTS ON" string that doesn't fit the 65px column — so state is
  // carried by aria-pressed (styled in CSS) and the label is left alone.
  if (btn) btn.setAttribute('aria-pressed', String(!isVisible));
}
