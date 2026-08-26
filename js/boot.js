/**
 * boot.js — synchronous head script (no defer/async).
 * Parser-blocking placement prevents FOUC without requiring unsafe-inline CSP.
 *
 * 1. Error telemetry
 * 2. Per-entry SEO meta bootstrapping (Googlebot first-pass)
 * 3. Dark/light mode FOUC prevention
 * 4. Boot gate removal
 */

// 1. Error telemetry
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('LEXICON_CORE_EXCEPTION:', msg, 'at line', lineNo, error);
};

// 2. Per-entry SEO bootstrapping
(function() {
  var m = window.location.pathname.match(/^\/entry\/([^/]+)(?:\/(\d+))?/);
  if (!m) return;
  var slug = m[1];
  var imgIdx = m[2] || '0';
  // Canonical URL always includes the image index for consistency
  var url = 'https://thelexicon.xyz/entry/' + slug + '/' + imgIdx;

  // Normalize URL: /entry/slug → /entry/slug/0 via replaceState
  if (!m[2]) {
    try { history.replaceState(null, '', '/entry/' + slug + '/0'); } catch(e) {}
  }

  var parts = slug.split('-');
  var seasonRe = /^(ss|aw|fw|pre|cruise|resort)(\d+)$/i;
  var last = parts[parts.length - 1];
  var name;
  var match = last.match(seasonRe);
  if (match) {
    var brand = parts.slice(0, -1).map(function(p) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
    name = brand + ' ' + match[1].toUpperCase() + match[2];
  } else {
    name = parts.map(function(p) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }
  var title = name + ' — THE LEXICON';
  var desc = 'Forensic visual analysis of ' + name + '. Annotated for visual and cultural research.';
  document.title = title;
  var set = function(sel, attr, val) {
    var el = document.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  };
  set('link[rel="canonical"]',           'href',    url);
  set('meta[property="og:url"]',         'content', url);
  set('meta[property="og:title"]',       'content', title);
  set('meta[property="og:description"]', 'content', desc);
  set('meta[property="og:type"]',        'content', 'article');
  set('meta[name="description"]',        'content', desc);
  set('meta[name="twitter:title"]',      'content', title);
  set('meta[name="twitter:description"]','content', desc);

  // Signal to app.js that this is an entry deep-link boot
  window.__LEXICON_BOOT_ENTRY__ = { slug: slug, idx: parseInt(imgIdx, 10) };
})();

// 3. Dark/light mode FOUC prevention
(function() {
  var saved;
  try { saved = localStorage.getItem('lexicon-theme'); } catch(e) {}
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
  var overlay = document.getElementById('boot-overlay');
  var root    = document.getElementById('app-root');
  if (overlay) overlay.classList.add('hidden');
  if (root)    root.classList.remove('opacity-0');
})();
