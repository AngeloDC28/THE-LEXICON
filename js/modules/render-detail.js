/**
 * render-detail.js
 * Logic for Detail View, Brutalist Nodes, and Geometric Hotspots.
 */
import { $, pad, resolveImgSrc, imgAttrs, webpSrc, thumbSrc, escapeHtml, BROKEN_ASSET, withViewTransition, splitSentences, seasonLong } from './core-utils.js?v=eb25565';
import { AppState, updateHash } from './core-state.js?v=eb25565';
import { getFilteredEntries } from './search-engine.js?v=eb25565';
import { getTranslation } from './translations.js?v=eb25565';
import { getTagCategory, categoryLabel, categoryPlain, seasonName } from './render-index-view.js?v=eb25565';
import { initGlossaryTooltips, renderGlossaryModal } from './glossary.js?v=eb25565';
import { placePayload, hidePayloadLeader } from './hotspots.js?v=eb25565';
import { safeCover } from './categories.js?v=eb25565';

export function updateStatusBar(archiveData) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  const brand       = $('status-brand');
  const year        = $('status-year');
  const season      = $('status-season');
  const entryStatus = $('status-entry');
  if (entry) {
    if (brand)       brand.textContent       = entry.tags?.brand || '--';
    if (year)        year.textContent        = entry.year;
    if (season)      season.textContent      = seasonLong(entry.season);
    // Same numbering as the entry panel's ‹ 36 / 45 › (position in the
    // current, filtered order), not the position in the raw data file.
    const filtered = getFilteredEntries(archiveData);
    const pos = filtered.findIndex(e => e.id === entry.id);
    if (entryStatus) entryStatus.textContent = pos >= 0 ? `${pos + 1} / ${filtered.length}` : '';
  } else {
    const filtered = getFilteredEntries(archiveData);
    if (brand)       brand.textContent       = 'ALL SHOWS';
    if (year) {
      const ys = archiveData.map(e => e.year).filter(Boolean);
      year.textContent = ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '—';
    }
    if (season)      season.textContent      = 'ALL';
    if (entryStatus) entryStatus.textContent = pad(filtered.length) + ' ' + getTranslation('label_entries', AppState.language);
  }
}

let _savedGridScrollTop = 0;

export function openDetail(entryId, imgIdx, archiveData, callbacks) {
  const entry = archiveData.find((e) => e.id === entryId);
  if (!entry) return;

  const imgs = entry.images;
  if (!imgs?.length) {
    console.warn(`[openDetail] entry ${entryId} has no images; aborting render.`);
    return;
  }

  // Store reference so renderSidebarHeader can build position counter
  AppState._archiveData = archiveData;

  // Save grid scroll position for restoration on close
  const imagePanel = $('image-panel');
  if (imagePanel) _savedGridScrollTop = imagePanel.scrollTop;

  // Detect same-entry navigation (image paging) vs. new entry — for URL strategy
  const _previousEntryId = AppState.selectedEntryId;

  AppState.selectedEntryId   = entryId;
  AppState.currentImageIndex = (typeof imgIdx === 'number') ? Math.min(imgIdx, imgs.length - 1) : 0;

  withViewTransition(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const detailView = $('detail-image-view');
    if (detailView) {
      detailView.classList.remove('hidden');
      // Used by print stylesheet ::after for permalink + accessed-date footer
      detailView.dataset.printUrl = `${window.location.origin}/entry/${entry.id}${AppState.currentImageIndex ? `/${AppState.currentImageIndex}` : ''}`;
      detailView.dataset.printAccessed = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const appRoot = $('app-root');
    if (appRoot) appRoot.classList.add('detail-mode-active');
    setArchiveInert(true);

    renderBreadcrumb(entry);
    renderImage(entry, callbacks);
    preloadAdjacentImages(entry);
    renderSidebarHeader(entry);
    renderMobileIntro(entry);
    renderBrutalistNodes(entry);
    renderStickyOverlay(entry);
    renderMetadataGrid(entry);
    renderSources(entry);
    renderRelatedEntries(entry, archiveData, callbacks);
    renderHotspots(entry, $('detail-image-wrapper'));
    setupSwipeGestures(archiveData, callbacks);
  });

  // Setup control panel listeners
  setupDetailControls();

  if (callbacks) {
    if (callbacks.updateHeaderTelemetry) callbacks.updateHeaderTelemetry(`ACCESSING_NODE: ${entry.id.toUpperCase()}`);
    if (callbacks.addRecentlyViewed)     callbacks.addRecentlyViewed(entryId);
    if (callbacks.updateBookmarkUI)      callbacks.updateBookmarkUI(entryId);
  }

  // Image navigation within same entry uses replaceState; new entry uses pushState
  const isSameEntry = _previousEntryId === entryId;
  updateHash(`detail/${entryId}/${AppState.currentImageIndex}`, isSameEntry);
  updateEntryJsonLd(entry);
  updateEntryMetaTags(entry);
  updateStatusBar(archiveData);
  document.dispatchEvent(new CustomEvent('lexicon-detail-opened'));
}

function updateEntryMetaTags(entry) {
  const brand  = entry.tags?.brand || '';
  const year   = entry.year || '';
  const season = entry.season ? entry.season + ' ' : '';
  const title  = entry.title ? entry.title : `${brand} ${season}${year}`.trim();
  const desc   = entry.subtitle
    ? `${title}: ${entry.subtitle}`
    : `Forensic visual analysis of ${title}. Annotated for visual and cultural research.`;
  const url    = `${window.location.origin}/entry/${entry.id}`;
  const img    = entry.images?.[0]?.src
    ? `${window.location.origin}/public/${entry.images[0].src}`
    : null;

  document.title = `${title} — THE LEXICON`;
  const setMeta = (sel, attr, val) => { if (val) { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); } };
  setMeta('meta[property="og:title"]',       'content', `${title} — THE LEXICON`);
  setMeta('meta[property="og:description"]', 'content', desc);
  setMeta('meta[property="og:url"]',         'content', url);
  setMeta('meta[property="og:type"]',        'content', 'article');
  setMeta('meta[name="description"]',        'content', desc);
  setMeta('meta[name="twitter:title"]',      'content', `${title} — THE LEXICON`);
  setMeta('meta[name="twitter:description"]','content', desc);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', url);
  if (img) {
    setMeta('meta[property="og:image"]',     'content', img);
    setMeta('meta[property="og:image:alt"]', 'content', `${title} — THE LEXICON archive`);
    setMeta('meta[name="twitter:image"]',    'content', img);
  }
}

function _resetEntryMetaTags() {
  document.title = 'THE LEXICON — fashion history, indexed analytically';
  const setMeta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
  setMeta('meta[property="og:title"]',       'content', 'THE LEXICON — fashion history, indexed analytically');
  setMeta('meta[property="og:description"]', 'content', 'A research archive mapping fashion history, visual culture, and the lineage of ideas.');
  setMeta('meta[property="og:url"]',         'content', window.location.origin + '/');
  setMeta('meta[property="og:type"]',        'content', 'website');
  setMeta('meta[name="description"]',        'content', 'A research archive mapping fashion history, visual culture, and the lineage of ideas — indexed by analytical category, not just designer.');
  setMeta('meta[name="twitter:title"]',      'content', 'THE LEXICON — fashion history, indexed analytically');
  setMeta('meta[name="twitter:description"]','content', '45 landmark collections, decoded by category, designer, era, and movement. A research archive for fashion history and visual culture.');
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', window.location.origin + '/');
}

function updateEntryJsonLd(entry) {
  const el = document.getElementById('entry-jsonld');
  if (!el) return;
  const brand  = entry.tags?.brand || '';
  const year   = entry.year || '';
  const season = entry.season || '';
  const title  = entry.title ? entry.title : `${brand} ${season} ${year}`.trim();
  const url    = `${window.location.origin}/entry/${entry.id}`;
  const img    = entry.images?.[0]?.src
    ? `${window.location.origin}/public/${entry.images[0].src}`
    : null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'name': `${title} — THE LEXICON`,
    'headline': title,
    'url': url,
    'mainEntityOfPage': { '@type': 'WebPage', '@id': url },
    'description': entry.subtitle || `Forensic visual analysis of ${title}.`,
    'author': { '@type': 'Organization', 'name': 'THE LEXICON', 'url': window.location.origin },
    'publisher': { '@type': 'Organization', 'name': 'THE LEXICON', 'url': window.location.origin },
    'keywords': [brand, season, year, entry.tags?.politics, entry.tags?.theories, entry.tags?.era].filter(Boolean).join(', '),
    'inLanguage': 'en',
  };
  if (img) ld.image = { '@type': 'ImageObject', 'url': img, 'representativeOfPage': true };
  el.textContent = JSON.stringify(ld);
}


// While an entry is open, the archive views behind it (hero, axis cards, the
// 45-card grid, timeline, index table, folders) stay in the DOM. Without
// inert, a screen reader heard the whole homepage, and its extra <h1>,
// before the show. inert takes them out of the accessibility tree and the
// tab order; it is removed again on close.
const BEHIND_ENTRY = ['grid-view', 'timeline-view', 'index-table-view', 'folders-view'];
function setArchiveInert(on) {
  BEHIND_ENTRY.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  });
}

export function closeDetail(callbacks, archiveData) {
  withViewTransition(() => {
    AppState.selectedEntryId = null;
    updateHash(null);
    _resetEntryMetaTags();
    const entryLd = document.getElementById('entry-jsonld');
    if (entryLd) entryLd.textContent = '';
    const detailView = $('detail-image-view');
    if (detailView) detailView.classList.add('hidden');
    const appRoot = $('app-root');
    if (appRoot) appRoot.classList.remove('detail-mode-active');
    setArchiveInert(false);
    updateStatusBar(archiveData);
    // Restore grid scroll position
    const imagePanel = $('image-panel');
    if (imagePanel && _savedGridScrollTop > 0) {
      requestAnimationFrame(() => {
        imagePanel.scrollTop = _savedGridScrollTop;
      });
    }
  });
}

export function navigateEntry(direction, archiveData, callbacks, entryOnly = false) {
  const entry = archiveData.find(e => e.id === AppState.selectedEntryId);
  if (!entry) return;
  if (!entryOnly) {
    const imgs = entry.images;
    const nextImg = AppState.currentImageIndex + direction;
    if (nextImg >= 0 && nextImg < imgs.length) {
      openDetail(entry.id, nextImg, archiveData, callbacks);
      return;
    }
  }
  const entries = getFilteredEntries(archiveData);
  if (entries.length <= 1) return;
  let currentIndex = entries.findIndex(e => e.id === AppState.selectedEntryId);
  if (currentIndex === -1) return;
  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = entries.length - 1;
  if (newIndex >= entries.length) newIndex = 0;
  const nextEntry = entries[newIndex];
  openDetail(nextEntry.id, 0, archiveData, callbacks);
}

function renderSidebarHeader(entry) {
  const header = $('detail-sidebar-header');
  if (!header) return;
  const lang = AppState.language;
  const cat = getTagCategory(entry.tags?.politics || '');
  const tagLabel = categoryPlain(cat);
  const brand = entry.tags?.brand ? getTranslation(entry.tags.brand, lang).toUpperCase() : '—';
  const year = entry.year || '----';
  const season = entry.season ? entry.season.toUpperCase() : '';

  // Build position counter using filtered set (same set arrow keys navigate)
  const filtered = getFilteredEntries(AppState._archiveData || []);
  const pos = filtered.findIndex(e => e.id === entry.id);
  const total = filtered.length;
  const posLabel = total > 0 ? `${pos + 1} / ${total}` : '';

  const vibes = Array.isArray(entry.vibes) ? entry.vibes.slice(0, 6) : [];
  const vibesHtml = vibes.length
    ? `<div class="detail-vibes" aria-label="Aesthetic tags">${vibes.map(v => `<button type="button" class="detail-vibe" data-vibe="${escapeHtml(v)}" aria-label="Find entries with the vibe: ${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('')}</div>`
    : '';

  // The entry's one <h1>. It used to be print-only, which left entry pages
  // with no heading at all for screen-reader navigation.
  const pageTitle = entry.title ? getTranslation(entry.title, lang) : `${brand} ${season} ${year}`.trim();
  const subtitle = entry.subtitle ? getTranslation(entry.subtitle, lang) : '';

  // A plain one-paragraph "what am I looking at?" before the analysis.
  const summary = entry.summary_plain ? getTranslation(entry.summary_plain, lang) : '';
  const when = [seasonName(entry.season), entry.year].filter(Boolean).join(' ');
  header.innerHTML = `
    <h1 class="detail-title">${escapeHtml(pageTitle)}${subtitle ? `<span class="detail-subtitle">${escapeHtml(subtitle)}</span>` : ''}</h1>
    <span class="detail-accent-tag" data-cat="${cat}">${tagLabel.toUpperCase()}</span>
    <div class="detail-entry-id">${brand} · ${season ? seasonLong(season) + ' ' : ''}${year}</div>
    ${entry.summary_plain ? `<p class="detail-summary"${lang !== 'en' && getTranslation(entry.summary_plain, lang) === entry.summary_plain ? ' lang="en"' : ''}>${escapeHtml(getTranslation(entry.summary_plain, lang))}</p>` : ''}
    ${vibesHtml}
    ${posLabel ? `
    <div class="detail-entry-nav" role="group" aria-label="Navigate entries">
      <button type="button" class="den-btn" id="btn-detail-prev" aria-label="Previous entry (←)" ${pos <= 0 ? 'disabled' : ''}>‹</button>
      <span class="den-pos" aria-live="polite" aria-atomic="true">${posLabel}</span>
      <button type="button" class="den-btn" id="btn-detail-next" aria-label="Next entry (→)" ${pos >= total - 1 ? 'disabled' : ''}>›</button>
    </div>` : ''}`;

  // Wire click handlers directly (sidebar is re-rendered on each entry open)
  header.querySelector('#btn-detail-prev')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('lexicon:entry-nav', { detail: { dir: -1 } }));
  });
  header.querySelector('#btn-detail-next')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('lexicon:entry-nav', { detail: { dir: 1 } }));
  });
}

// Phones and tablets: the side column with the title is hidden, so a reader
// saw only a photo. This short block under the breadcrumb names the show and
// says what it is. Hidden at ≥1024px, where the side column shows instead.
function renderMobileIntro(entry) {
  const el = $('detail-mobile-intro');
  if (!el) return;
  const lang = AppState.language;
  const cat = getTagCategory(entry.tags?.politics || '');
  const brand = entry.tags?.brand ? getTranslation(entry.tags.brand, lang) : '';
  const when = [seasonName(entry.season), entry.year].filter(Boolean).join(' ');
  const subtitle = entry.subtitle ? getTranslation(entry.subtitle, lang) : '';
  const summary = entry.summary_plain ? getTranslation(entry.summary_plain, lang) : '';
  el.innerHTML = `
    <h1 class="dmi-title">${escapeHtml(brand)}<span class="dmi-when">${escapeHtml(when)}${subtitle ? ' · ' + escapeHtml(subtitle) : ''}</span></h1>
    <span class="detail-accent-tag" data-cat="${cat}">${escapeHtml(categoryPlain(cat).toUpperCase())}</span>
    ${summary ? `<p class="dmi-summary">${escapeHtml(summary)}</p>` : ''}`;
}

function renderBreadcrumb(entry) {
  const crumb = $('detail-breadcrumb');
  if (!crumb) return;
  const brand = entry.tags?.brand || '—';
  const politics = entry.tags?.politics || '';
  const cat = getTagCategory(politics);
  const tagCat = categoryPlain(cat).toUpperCase();
  // Season alone ("SS") isn't an identifier — the breadcrumb used to read
  // "ALEXANDER MCQUEEN / SS" with no year.
  const season = [entry.season, entry.year].filter(Boolean).join(' ');
  const sep = `<span class="mx-1 opacity-30">/</span>`;
  crumb.innerHTML =
    `<a href="#" class="hover:text-white/60 transition-colors focus-ring" data-crumb-back aria-label="Back to all shows">ALL SHOWS</a>`
    + sep
    + `<span class="detail-breadcrumb-cat" data-cat="${cat}">${tagCat}</span>`
    + sep
    + `<span class="text-white/50">${escapeHtml(brand.toUpperCase())}</span>`
    + (season ? sep + `<span class="text-white/70">${escapeHtml(season.slice(0, 30).toUpperCase())}</span>` : '');
  crumb.classList.remove('hidden');
  crumb.querySelector('[data-crumb-back]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('lexicon:close-detail'));
  });
}

// Looks with nudity carry a content_note. The image is blurred behind a
// short note until the reader chooses to see it; the choice lasts for the
// visit (sessionStorage), so they aren't asked again on every look.
const REVEAL_KEY = 'lexicon_reveal_sensitive';
function sensitiveRevealed() {
  try { return sessionStorage.getItem(REVEAL_KEY) === '1'; } catch { return false; }
}
function renderContentNote(imgObj) {
  const wrapper = $('detail-image-wrapper');
  if (!wrapper) return;
  wrapper.querySelector('.content-note-veil')?.remove();
  const note = imgObj?.content_note;
  const veiled = !!note && !sensitiveRevealed();
  wrapper.classList.toggle('is-veiled', veiled);
  if (!veiled) return;
  const veil = document.createElement('div');
  veil.className = 'content-note-veil';
  veil.innerHTML = `
    <p class="content-note-label">Content note</p>
    <p class="content-note-text">${escapeHtml(note)}</p>
    <button type="button" class="content-note-btn">Show image</button>`;
  // The image wrapper opens the full-screen zoom on click; the veil must not.
  veil.addEventListener('click', (e) => e.stopPropagation());
  veil.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    try { sessionStorage.setItem(REVEAL_KEY, '1'); } catch { /* private mode: reveal this one only */ }
    wrapper.classList.remove('is-veiled');
    veil.remove();
    document.querySelectorAll('.grid-cell.is-veiled').forEach(c => c.classList.remove('is-veiled'));
  });
  wrapper.appendChild(veil);
}

function renderImage(entry, callbacks) {
  const imgs = entry.images;
  const currentImgObj = imgs[AppState.currentImageIndex];
  const currentImgSrc = resolveImgSrc(currentImgObj);

  const imgEl  = $('detail-image');
  const webpEl = $('detail-image-webp');
  if (imgEl) {
    imgEl.onerror = () => {
      // Detach handler before assigning fallback so a broken
      // BROKEN_ASSET data-URI can't trigger an infinite onerror loop.
      imgEl.onerror = null;
      imgEl.src = BROKEN_ASSET;
      if (webpEl) webpEl.srcset = '';
    };
    imgEl.onload = () => {
      if (callbacks && callbacks.extractAccentColor) callbacks.extractAccentColor(imgEl);
    };
    // Phones get the 480px thumbnail (the image shows at ~430px wide there);
    // larger screens the 1000px file. Saves ~4x the bytes on mobile data.
    if (webpEl) {
      webpEl.srcset = `${resolveImgSrc({ src: thumbSrc(currentImgObj) })} 480w, ${resolveImgSrc({ src: webpSrc(currentImgObj) })} 1000w`;
      webpEl.sizes = '(max-width: 1023px) 92vw, 50vw';
    }
    // Apply known dimensions to prevent CLS while the new image loads.
    const dims = imgAttrs(currentImgObj);
    if (dims) {
      const w = dims.match(/width="(\d+)"/);
      const h = dims.match(/height="(\d+)"/);
      if (w) imgEl.setAttribute('width', w[1]);
      if (h) imgEl.setAttribute('height', h[1]);
    }
    imgEl.src = currentImgSrc;
    const baseAlt = entry.title
      || [entry.tags?.brand, entry.season, entry.year].filter(Boolean).join(' ')
      || entry.id;
    // "Look 3 of 16" says nothing about the picture. The hotspot labels are
    // already a curated description of what is in it, so use them.
    const parts = (currentImgObj?.hotspots || []).map(h => h.label).filter(Boolean);
    const described = parts.length ? `: ${parts.join(', ')}` : '';
    imgEl.alt = `${baseAlt}, look ${(AppState.currentImageIndex || 0) + 1} of ${imgs.length}${described}`;
  }

  renderContentNote(currentImgObj);

  const titleEl = $('active-entry-title');
  if (titleEl) {
    const brand = getTranslation(entry.tags.brand, AppState.language);
    const currentImgObj2 = imgs[AppState.currentImageIndex];
    const hotspotCount = (currentImgObj2?.hotspots || []).length;
    const annLabel = hotspotCount === 1
      ? getTranslation('hotspot_annotation', AppState.language)
      : getTranslation('hotspot_annotations', AppState.language);
    const hotspotSuffix = hotspotCount > 0 ? ` · ${hotspotCount} ${annLabel}` : '';
    titleEl.textContent = `${brand} ${entry.year} [${pad(AppState.currentImageIndex + 1)}/${pad(imgs.length)}]${hotspotSuffix}`;
  }

  // Image credit / attribution
  const creditEl = $('detail-image-credit');
  if (creditEl) {
    const slug  = entry.id || '';
    const contactHref = `mailto:info@thelexicon.xyz?subject=Image%20credit%3A%20${encodeURIComponent(slug)}`;
    // The fallback used to read "Source: <Brand> press archive", which was
    // an invented attribution. If the credit isn't confirmed yet, say so.
    const credit = entry.photo_credit
      ? `Photo: ${escapeHtml(entry.photo_credit)}`
      : 'Photographer credit being confirmed';
    const src = entry.image_source;
    const via = src?.url
      ? ` · via <a href="${escapeHtml(src.url)}" class="underline hover:text-acid focus:text-acid transition-colors" target="_blank" rel="noopener noreferrer">${escapeHtml(src.name)}</a>`
      : '';
    const mistakeHref = `mailto:info@thelexicon.xyz?subject=${encodeURIComponent(`Problem with ${entry.title || slug}`)}`;
    creditEl.innerHTML = `<span>${credit}</span>${via} · <a href="${contactHref}" class="underline hover:text-acid focus:text-acid transition-colors">Rights holder?</a> · <a href="${mistakeHref}" class="underline hover:text-acid focus:text-acid transition-colors">Spotted a mistake?</a>`;
  }

  // Image counter dots
  const counter = $('image-counter');
  if (counter) {
    counter.dataset.count = imgs.length;
    if (imgs.length > 1) {
      const currentIdx = AppState.currentImageIndex;
      counter.innerHTML = imgs.map((_, i) => {
        const isActive = i === currentIdx;
        return `<button type="button" class="img-dot${isActive ? ' active' : ''}" data-img-index="${i}" aria-label="Image ${i + 1} of ${imgs.length}"${isActive ? ' aria-current="true"' : ''}></button>`;
      }).join('') + `<span class="img-count">Look ${currentIdx + 1} of ${imgs.length}</span>`;
      counter.querySelectorAll('.img-dot').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.imgIndex, 10);
          if (idx !== AppState.currentImageIndex) {
            AppState.currentImageIndex = idx;
            renderImage(entry, callbacks);
            renderHotspots(entry, $('detail-image-wrapper'));
          }
        });
      });
    } else {
      counter.innerHTML = '';
    }
  }
}

/**
 * renderBrutalistNodes
 * Injects the Tricolour sticky notes into the sidebar.
 */
function renderBrutalistNodes(entry) {
  const container = $('sticky-note-container');
  if (!container) return;

  // We want to keep the Analytical Payload div, so we clear only other nodes
  const existingNodes = container.querySelectorAll('.brutalist-node:not(#analytical-payload)');
  existingNodes.forEach(n => n.remove());

  const lang = AppState.language;
  const t = (k) => getTranslation(k, lang);

  const nodeTypes = [
    { id: 'provenance', num: '01', label: t('note_provenance'), class: 'node-provenance' },
    { id: 'critique',   num: '02', label: t('note_critique'),   class: 'node-critique'   },
    { id: 'strategy',   num: '03', label: t('note_strategy'),   class: 'node-strategy'   }
  ];

  nodeTypes.forEach(type => {
    let rawText = entry.notes?.[type.id] || '';
    if (!rawText) return;
    let text = getTranslation(rawText, lang);
    text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();

    if (text) {
      const node = document.createElement('article');
      node.className = `brutalist-node ${type.class}`;
      node.dataset.noteId = type.id;
      node.id = `note-${type.id}`;
      node.setAttribute('aria-labelledby', `note-${type.id}-label`);
      // An untranslated note inside a translated page is still English:
      // say so, so screen readers switch voice (WCAG 3.1.2).
      if (lang !== 'en' && getTranslation(rawText, lang) === rawText) node.lang = 'en';

      // Critique note gets a pull quote — extract the first sentence 40–250 chars
      let bodyHtml = text;
      if (type.id === 'critique') {
        const sentences = splitSentences(text);
        const pullIdx = sentences.findIndex(s => s.length >= 40 && s.length <= 280);
        if (pullIdx >= 0) {
          const pull = sentences.splice(pullIdx, 1)[0];
          bodyHtml = sentences.length
            ? `<blockquote class="note-pullquote">${pull}</blockquote>${sentences.join(' ')}`
            : `<blockquote class="note-pullquote">${pull}</blockquote>`;
        }
      }

      node.innerHTML = `
        <h3 id="note-${type.id}-label" class="node-label"><span class="node-num">${type.num}</span> [ ${type.label.toUpperCase()} ]<span class="node-plain"> · ${escapeHtml(t(`note_${type.id}_plain`))}</span></h3>
        <div class="node-body">${bodyHtml}</div>
      `;
      container.appendChild(node);
    }
  });

  // Show reading time estimate in sidebar header
  const readingEl = document.getElementById('detail-reading-time');
  if (readingEl) {
    const allText = ['provenance', 'critique', 'strategy']
      .map(k => entry.notes?.[k] || '')
      .join(' ');
    const wordCount = allText.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(wordCount / 200));
    const tpl = getTranslation('label_reading_time', AppState.language);
    readingEl.textContent = tpl
      .replace('{words}', wordCount)
      .replace('{mins}', mins);
  }

  // Inject a mini TOC above the nodes for reading mode
  const toc = document.createElement('div');
  toc.className = 'notes-toc';
  toc.id = 'notes-toc';
  toc.innerHTML = nodeTypes
    .filter(nt => entry.notes?.[nt.id])
    .map(nt => `<a href="#note-${nt.id}" class="notes-toc-link" data-toc-target="${nt.id}">
      <span class="ntl-num">${nt.num}</span>
      <span class="ntl-label">${nt.label.toUpperCase()}</span>
    </a>`).join('');
  container.prepend(toc);

  // Activate glossary tooltips on note text
  initGlossaryTooltips(container);
}

/**
 * renderStickyOverlay
 * Tricolour square triggers (top-right of image). Clicking a square
 * reveals its note content in the right-side #sticky-note-panel.
 */
function renderStickyOverlay(entry) {
  const squaresEl = $('sticky-squares');
  if (!squaresEl) return;
  squaresEl.innerHTML = '';

  // Reset panel state for new entry
  const panel      = $('sticky-note-panel');
  const panelLabel = $('sticky-panel-label');
  const panelBody  = $('sticky-panel-body');
  const panelHdr   = $('sticky-panel-header');
  if (panel) panel.classList.remove('visible');

  const lang = AppState.language;
  const t    = (k) => getTranslation(k, lang);

  const noteTypes = [
    { id: 'provenance', label: t('note_provenance') || 'AUDIT PROVENANCE',  cls: 'sq-provenance', bg: '#0A0A0A', fg: '#CCFF00' },
    { id: 'critique',   label: t('note_critique')   || 'FORENSIC CRITIQUE', cls: 'sq-critique',   bg: '#0A0A0A', fg: '#FF5A47' },
    { id: 'strategy',   label: t('note_strategy')   || 'ISOLATE STRATEGY',  cls: 'sq-strategy',   bg: '#0A0A0A', fg: '#6F86FF' }
  ];

  let activeId = null;
  let activeSq = null;

  const closePanel = () => {
    if (panel) panel.classList.remove('visible');
    squaresEl.querySelectorAll('.sticky-square').forEach(s => s.classList.remove('active'));
    if (activeSq) requestAnimationFrame(() => activeSq?.focus());
    activeId = null;
    activeSq = null;
  };

  const closeBtn = $('btn-close-sticky-panel');
  if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closePanel(); };

  noteTypes.forEach(type => {
    let rawText = entry.notes?.[type.id] || '';
    if (!rawText) return;
    let text = getTranslation(rawText, lang);
    text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();
    if (!text) return;

    const sq = document.createElement('button');
    sq.type = 'button';
    sq.className = `sticky-square ${type.cls}`;
    // Colour alone carried the meaning (WCAG 1.4.1); show the name too.
    sq.textContent = type.label;
    sq.setAttribute('aria-expanded', 'false');

    sq.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeId === type.id) { closePanel(); return; }
      activeId = type.id;
      activeSq = sq;

      squaresEl.querySelectorAll('.sticky-square').forEach(s => s.classList.remove('active'));
      sq.classList.add('active');

      if (panelHdr) {
        panelHdr.style.background  = type.bg;
        panelHdr.style.color       = type.fg;
        panelHdr.style.borderColor = type.fg;
      }
      if (panelLabel) { panelLabel.textContent = type.label; panelLabel.style.color = type.fg; }
      if (closeBtn)   closeBtn.style.color = type.fg;
      if (panelBody)  panelBody.textContent = text;
      if (panel)      panel.classList.add('visible');
    });

    squaresEl.appendChild(sq);
  });
}

function renderMetadataGrid(entry) {
  const grid = $('metadata-grid');
  if (!grid || !entry.tags) return;
  const lang = AppState.language;
  const t = (key) => getTranslation(key, lang);
  const fields = [
    { key: 'era',       label: t('tax_era'),       value: entry.tags.era },
    { key: 'politics',  label: t('tax_politics'),  value: entry.tags.politics },
    { key: 'theories',  label: t('tax_theories'),  value: entry.tags.theories },
    { key: 'anatomy',   label: t('tax_anatomy'),   value: entry.tags.anatomy },
    { key: 'materials', label: t('tax_materials'), value: entry.tags.materials },
    { key: 'geography', label: t('tax_geography'), value: entry.tags.geography },
    { key: 'gender',    label: t('tax_gender'),    value: entry.tags.gender },
    { key: 'format',    label: t('tax_format'),    value: entry.tags.format },
  ].filter(f => f.value);
  grid.innerHTML = fields.map(f => {
    const translated = getTranslation(f.value, lang) || '--';
    if (!f.value) {
      return `<div class="space-y-1">
        <div class="text-[7px] font-mono uppercase tracking-[0.2em] text-white/40">${f.label}</div>
        <div class="text-[8px] font-mono uppercase tracking-wide text-white/30">--</div>
      </div>`;
    }
    return `<button type="button" class="metadata-tag-btn group text-left space-y-1 hover:bg-white/5 transition-colors p-1 -m-1 focus-ring" data-tax-type="${f.key}" data-tax-value="${f.value.replace(/"/g, '&quot;')}" aria-label="Filter archive by ${f.label}">
      <div class="text-[7px] font-mono uppercase tracking-[0.2em] text-white/40 group-hover:text-acid transition-colors">${f.label} ›</div>
      <div class="text-[8px] font-mono uppercase tracking-wide text-white group-hover:text-acid transition-colors">${translated}</div>
    </button>`;
  }).join('');
}

/**
 * renderMetaRail
 * Populates the Phase 3 left metadata rail (visible at ≥1400px).
 * Shows entry ID, analytical category, and taxonomy axes at a glance
 * without requiring sidebar scroll.
 */
function renderMetaRail(entry) {
  const rail = $('meta-rail-body');
  if (!rail) return;
  const lang = AppState.language;
  const t    = (k) => getTranslation(k, lang);
  const cat  = getTagCategory(entry.tags?.politics || '');
  const catLabel = categoryLabel(cat);
  const taxRows = [
    { key: 'brand',     label: t('tax_brand') },
    { key: 'era',       label: t('tax_era') },
    { key: 'politics',  label: t('tax_politics') },
    { key: 'theories',  label: t('tax_theories') },
    { key: 'gender',    label: t('tax_gender') },
    { key: 'geography', label: t('tax_geography') },
    { key: 'format',    label: t('tax_format') },
    { key: 'materials', label: t('tax_materials') },
    { key: 'anatomy',   label: t('tax_anatomy') },
  ];

  rail.innerHTML = `
    <div class="meta-rail-section">
      <div class="meta-rail-cat">${catLabel}</div>
    </div>
    <div class="meta-rail-section">
      <span class="meta-rail-label">${t('tax_year_season') || 'Year / Season'}</span>
      <div class="meta-rail-value">${entry.year || '—'} · ${entry.season || '—'}</div>
    </div>
    ${taxRows.map(({ key, label }) => {
      const val = entry.tags?.[key];
      if (!val) return '';
      const translated = getTranslation(val, lang);
      return `<div class="meta-rail-section">
        <span class="meta-rail-label">${label}</span>
        <div class="meta-rail-value">${translated}</div>
      </div>`;
    }).join('')}
  `;
}

/**
 * renderSources
 * The references behind an entry's analysis, as a numbered list in a
 * citation-like format: Author, "Title," Publication, Date.
 */
function renderSources(entry) {
  const section = $('sources-section');
  const list = $('sources-list');
  if (!section || !list) return;
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  if (!sources.length) { section.classList.add('hidden'); list.innerHTML = ''; return; }
  section.classList.remove('hidden');
  list.innerHTML = sources.map(s => {
    const title = s.type === 'book' || s.type === 'catalogue'
      ? `<cite>${escapeHtml(s.title)}</cite>`
      : `“${escapeHtml(s.title)}”`;
    const parts = [s.author ? escapeHtml(s.author) : '', title, s.publication ? `<span class="src-pub">${escapeHtml(s.publication)}</span>` : '', s.date ? escapeHtml(s.date) : ''].filter(Boolean);
    const link = s.url ? ` <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="src-link">Link ↗</a>` : '';
    const note = s.note ? `<div class="src-note">${escapeHtml(s.note)}</div>` : '';
    return `<li>${parts.join(', ')}.${link}${note}</li>`;
  }).join('');
}

/**
 * renderRelatedEntries
 * Surface up to 6 related entries inline at the bottom of the metadata
 * sidebar, scored by how many tags they share with the current entry.
 * Tap a thumbnail → open that entry. Tap "View All Nexus" → opens the
 * full connection matrix.
 */
function renderRelatedEntries(entry, archiveData, callbacks) {
  const section = $('related-entries-section');
  const grid    = $('related-entries-grid');
  if (!section || !grid || !entry.tags) return;

  const tagKeys = ['brand', 'era', 'politics', 'theories', 'gender', 'materials', 'geography', 'anatomy', 'format'];
  const myTags = {};
  for (const k of tagKeys) if (entry.tags[k]) myTags[k] = entry.tags[k];

  const scored = archiveData
    // Skip entries that lack tags OR a usable cover image (drafts) so
    // the related panel never renders a broken-image card.
    .filter(e => e.id !== entry.id && e.tags && e.images?.[0]?.src)
    .map(e => {
      let score = 0;
      for (const k of tagKeys) if (myTags[k] && e.tags[k] === myTags[k]) score++;
      return { e, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  const lang = AppState.language;
  grid.innerHTML = scored.map(({ e, score }) => {
    const thumb = safeCover(e);
    const src   = resolveImgSrc(thumb);
    const brand = e.tags.brand ? getTranslation(e.tags.brand, lang) : '';
    return `<button type="button" class="related-entry-btn group text-left focus-ring" data-related-id="${e.id}" aria-label="${brand} ${e.year || ''} · ${score} shared tag${score>1?'s':''}. Open entry">
      <div class="aspect-[3/4] overflow-hidden bg-white/5 mb-1">
        <picture>
          <source type="image/webp" srcset="${resolveImgSrc({src: thumbSrc(thumb)})}">
          <img src="${src}"${imgAttrs(thumb)} alt="${brand}" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </picture>
      </div>
      <div class="text-[8px] font-mono uppercase tracking-wider text-white/70 truncate group-hover:text-acid transition-colors">${brand}</div>
      <div class="text-[7px] font-mono text-white/40">${e.year || '----'}</div>
    </button>`;
  }).join('');

  grid.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => {
      img.src = BROKEN_ASSET;
    }, { once: true });
  });

  // Wire click delegation once
  if (!grid._relatedClickBound) {
    grid._relatedClickBound = true;
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.related-entry-btn');
      if (!btn) return;
      const id = btn.dataset.relatedId;
      if (id && callbacks?.openDetail) callbacks.openDetail(id);
    });
  }
}

/**
 * renderHotspots
 * Geometric crosshair targets.
 */
function renderHotspots(entry, container) {
  if (!container) return;
  container.querySelectorAll('.hotspot-btn').forEach(el => el.remove());

  // Reset all hotspot state for the new entry/image
  AppState.activeHotspot = null;
  const payloadEl = $('analytical-payload');
  if (payloadEl) {
    payloadEl.classList.add('hidden');
    payloadEl.classList.remove('permanent-payload', 'expand-active');
    hidePayloadLeader();
  }
  const mobileSheet = $('mobile-hotspot-sheet');
  if (mobileSheet) {
    mobileSheet.classList.remove('open');
    mobileSheet.setAttribute('aria-hidden', 'true');
  }

  const imgs = entry.images;
  const currentImgObj = imgs[AppState.currentImageIndex];
  const hotspots = currentImgObj?.hotspots || [];

  hotspots.forEach((spot, i) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot-btn';
    btn.style.left = spot.x + '%';
    btn.style.top  = spot.y + '%';
    btn.setAttribute('data-index', i);
    btn.setAttribute('aria-label', spot.label ? `Hotspot: ${spot.label}` : `Hotspot ${i + 1}`);
    btn.setAttribute('type', 'button');
    btn.innerHTML = '<div class="hotspot-target"></div>';

    btn.setAttribute('aria-describedby', 'analytical-payload');
    // Desktop hover/focus preview. Click delegation is handled by hotspots.js.
    btn.addEventListener('mouseenter', () => showPayload(spot, btn));
    btn.addEventListener('mouseleave', () => hidePayload());
    btn.addEventListener('focus',      () => showPayload(spot, btn));
    btn.addEventListener('blur',       () => hidePayload());

    container.appendChild(btn);
  });
}

function showPayload(spot, btn) {
  const payload = $('analytical-payload');
  const content = $('payload-content');
  if (!payload || !content) return;

  // Don't override a permanent (clicked) payload with a hover preview
  if (payload.classList.contains('permanent-payload')) return;

  const lang = AppState.language;
  const label = getTranslation(spot.label, lang);
  let text = getTranslation(spot.description || '', lang);
  text = text.replace(/\[cite:\s*\d+\]/g, '').replace(/—/g, ' —').replace(/--/g, ' —').trim();

  content.innerHTML = `
    <div class="t-mono-xs font-bold mb-2 border-b border-black/10 pb-1">${escapeHtml(String(label || '').toUpperCase())}</div>
    <div class="t-mono-xs leading-relaxed">${escapeHtml(text)}</div>
  `;
  payload.classList.remove('hidden');
  // Beside the image, not on it — same placement as a clicked hotspot.
  placePayload(btn);
}

function hidePayload() {
  const payload = $('analytical-payload');
  if (!payload || payload.classList.contains('permanent-payload')) return;
  payload.classList.add('hidden');
  hidePayloadLeader();
}

// Track in-flight preloads so rapid navigation can cancel them
let _preloadAbort = null;

function preloadAdjacentImages(entry) {
  // Cancel any in-flight preloads from previous navigation
  if (_preloadAbort) _preloadAbort.abort();
  _preloadAbort = new AbortController();

  const imgs = entry.images;
  const idx = AppState.currentImageIndex;
  [-1, 1].forEach(offset => {
    const adj = imgs[idx + offset];
    if (adj) {
      // Preload WebP (what <picture> will actually request) instead of JPEG
      const webpUrl = resolveImgSrc({ src: webpSrc(adj) });
      const jpegUrl = resolveImgSrc(adj);
      const img = new Image();
      img.src = webpUrl || jpegUrl;
    }
  });
}

let swipeTouchStartX = null;
let swipeTouchStartY = null;
let swipeCallbackRef = null;

function setupSwipeGestures(archiveData, callbacks) {
  const wrapper = $('detail-image-wrapper');
  if (!wrapper) return;

  if (swipeCallbackRef) {
    wrapper.removeEventListener('touchstart', swipeCallbackRef.start);
    wrapper.removeEventListener('touchend', swipeCallbackRef.end);
  }

  const onStart = (e) => {
    swipeTouchStartX = e.touches[0].clientX;
    swipeTouchStartY = e.touches[0].clientY;
  };
  const onEnd = (e) => {
    if (swipeTouchStartX === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY;
    swipeTouchStartX = null;
    swipeTouchStartY = null;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    navigateEntry(dx < 0 ? 1 : -1, archiveData, callbacks);
  };

  wrapper.addEventListener('touchstart', onStart, { passive: true });
  wrapper.addEventListener('touchend', onEnd, { passive: true });
  swipeCallbackRef = { start: onStart, end: onEnd };
}

function setupDetailControls() {
  const fsBtn = $('btn-fullscreen-toggle');
  if (fsBtn) {
    fsBtn.onclick = () => toggleFullscreen();
  }

  // Auto-reveal the metadata sidebar on desktop so sticky notes, tech specs,
  // and related entries are visible without a hunt. Mobile still uses the
  // bottom-sheet pattern (sidebar would overflow a phone width).
  const sidebar = $('detail-metadata-sidebar');
  if (sidebar && window.innerWidth >= 1024) sidebar.classList.remove('hidden');

  const taxToggle = $('btn-tax-toggle');
  if (taxToggle) {
    const labelFor = (hidden) => getTranslation(hidden ? 'btn_visualise_tax' : 'btn_hide_tax', AppState.language);
    // Sync initial text to current sidebar state
    taxToggle.textContent = labelFor(sidebar && sidebar.classList.contains('hidden'));
    // Re-fetch language on each click so toggling reflects the current
    // locale, not whatever was active when this handler was bound.
    taxToggle.onclick = () => {
      sidebar.classList.toggle('hidden');
      taxToggle.textContent = labelFor(sidebar.classList.contains('hidden'));
    };
  }
  // Note: btn-back-grid is wired in app.js's setupEventListeners().
}

function toggleFullscreen() {
  const detailView = $('detail-image-view');
  if (!detailView) return;
  if (!document.fullscreenElement) {
    detailView.requestFullscreen().catch(err => console.warn(err));
  } else {
    document.exitFullscreen();
  }
}
