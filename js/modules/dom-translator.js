/**
 * DOM-level translation via Google's unofficial translate API.
 * No widget, no branding, no injected fonts — pure API calls.
 *
 * Flow on language change:
 *   1. restoreAll()     — put every saved text node back to its English original
 *   2. (caller) refreshUI() — re-renders JS-controlled strings in English
 *   3. translate(lang)  — walks DOM, batches + fetches, updates text nodes
 *   4. MutationObserver — re-translates any nodes added by dynamic rendering
 */

const API = 'https://translate.googleapis.com/translate_a/single';
const CHAR_LIMIT = 3500;   // per-request character budget (GET URL stays well under limits)
const SEP = '\n';          // batch separator — sources are whitespace-normalised, so they never contain one
const CONCURRENCY = 4;     // requests in flight at once
const CACHE_PFX = 'lx-tx2:'; // bumped: v1 entries could hold misaligned results

// Tags whose content should never be translated
const SKIP_TAGS = new Set([
  'SCRIPT','STYLE','CODE','PRE','KBD','SAMP','NOSCRIPT','TEMPLATE',
  'SVG','MATH','INPUT','TEXTAREA','SELECT'
]);

// Map: text node → English original text (Map, not WeakMap — must be iterable for restoreAll)
const _orig = new Map();
let _obs = null;
let _gen = 0; // incremented on every translate() call, used to abort stale fetches

// Attributes carrying screen-reader / tooltip content — translated alongside text nodes
const TRANSLATE_ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
const _origAttrs = new Map(); // element → { attr: original } (Map for iterability in restoreAll)

// ─── helpers ────────────────────────────────────────────────────────────────

function _skip(node) {
  let el = node.parentElement;
  while (el && el !== document.body) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-notranslate')) return true;
    if (el.hasAttribute('translate') && el.getAttribute('translate') === 'no') return true;
    el = el.parentElement;
  }
  return false;
}

function _collect(root) {
  const walker = document.createTreeWalker(
    root || document.body,
    NodeFilter.SHOW_TEXT,
    { acceptNode: n => (n.textContent.trim() && !_skip(n))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
  );
  const out = [];
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}

function _hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ─── API ────────────────────────────────────────────────────────────────────

async function _apiFetch(text, lang) {
  const url = `${API}?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  const data = await r.json();
  return data[0].map(seg => seg[0]).join('');
}

// Text nodes carry template indentation ("\n      Strategy …\n    "). Translate
// only the collapsed core and put the surrounding whitespace back, so a
// source string can never contain the batch separator.
function _core(s) { return s.replace(/\s+/g, ' ').trim(); }
function _rewrap(original, translated) {
  const lead = original.match(/^\s*/)[0];
  const trail = original.match(/\s*$/)[0];
  return lead + translated + trail;
}

/**
 * Translate an array of whitespace-free-of-newline strings, returning an
 * array of the same length in the same order — or null if the service
 * didn't give back one line per input (in which case the caller splits the
 * batch rather than guessing an alignment).
 */
async function _translateLines(lines, lang) {
  const joined = lines.join(SEP);
  const cacheKey = CACHE_PFX + lang + ':' + _hash(joined);
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  const raw = await _apiFetch(joined, lang);
  const out = raw.split(SEP).map(s => s.trim());
  if (out.length !== lines.length) return null;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch (_) {}
  return out;
}

/** Fill `map` for every string in `lines`, splitting on any misalignment. */
async function _translateInto(lines, lang, gen, map) {
  if (!lines.length || gen !== _gen) return;
  let out = null;
  try {
    out = await _translateLines(lines, lang);
  } catch (_) {
    return; // network / rate-limit failure: leave these in English
  }
  if (gen !== _gen) return;
  if (out) { lines.forEach((src, i) => map.set(src, out[i] || src)); return; }
  // Line count came back different (the service merged or split a line).
  // Never guess — the old code padded the array, which put translations on
  // the wrong elements. Halve and retry; a single line cannot misalign.
  if (lines.length === 1) return;
  const mid = Math.ceil(lines.length / 2);
  await _translateInto(lines.slice(0, mid), lang, gen, map);
  await _translateInto(lines.slice(mid), lang, gen, map);
}

async function _translateBatch(pairs, lang, gen) {
  if (!pairs.length) return;

  // Deduplicate on the normalised text: only send unique source strings
  const unique = [...new Set(pairs.map(p => _core(p.src)).filter(Boolean))];

  // Split into char-budget chunks
  const chunks = [];
  let chunk = [], len = 0;
  for (const t of unique) {
    if (len + t.length > CHAR_LIMIT && chunk.length) {
      chunks.push(chunk); chunk = []; len = 0;
    }
    chunk.push(t);
    len += t.length + SEP.length;
  }
  if (chunk.length) chunks.push(chunk);

  const map = new Map(); // normalised src → translated text
  const apply = () => {
    for (const { node, src } of pairs) {
      const tx = map.get(_core(src));
      if (tx && tx !== _core(src) && node.isConnected) node.textContent = _rewrap(src, tx);
    }
  };

  // A small worker pool: the page has hundreds of strings, and sending the
  // chunks one after another left content in English for a long time.
  // Results are applied as each chunk lands, not all at the end.
  let next = 0;
  const worker = async () => {
    while (next < chunks.length && gen === _gen) {
      const ch = chunks[next++];
      await _translateInto(ch, lang, gen, map);
      if (gen === _gen) apply();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));
}

// ─── Observer ───────────────────────────────────────────────────────────────

function _startObserver(lang, gen) {
  _obs?.disconnect();
  _obs = new MutationObserver(muts => {
    const added = [];
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && !_skip(node)) {
          added.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          added.push(..._collect(node));
        }
      }
    }
    if (!added.length) return;
    const pairs = added.map(node => {
      if (!_orig.has(node)) _orig.set(node, node.textContent);
      return { node, src: _orig.get(node) };
    }).filter(p => p.src.trim());
    _translateBatch(pairs, lang, gen);
  });
  _obs.observe(document.body, { childList: true, subtree: true });
}

// ─── Attribute translation ────────────────────────────────────────────────────

function _collectAttrPairs(root) {
  const sel = TRANSLATE_ATTRS.map(a => `[${a}]`).join(',');
  const pairs = [];
  for (const el of (root || document.body).querySelectorAll(sel)) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    let skip = false, anc = el;
    while (anc && anc !== document.body) {
      if (anc.hasAttribute('data-notranslate') ||
          (anc.hasAttribute('translate') && anc.getAttribute('translate') === 'no')) {
        skip = true; break;
      }
      anc = anc.parentElement;
    }
    if (skip) continue;
    for (const attr of TRANSLATE_ATTRS) {
      const val = el.getAttribute(attr);
      if (!val?.trim()) continue;
      let map = _origAttrs.get(el);
      if (!map) { map = {}; _origAttrs.set(el, map); }
      if (!map[attr]) map[attr] = val;
      pairs.push({ el, attr, src: map[attr] });
    }
  }
  return pairs;
}

async function _applyAttrTranslations(attrPairs, lang, gen) {
  if (!attrPairs.length || gen !== _gen) return;
  // Wrap as virtual objects so _translateBatch can be reused as-is
  const pairs = attrPairs.map(({ el, attr, src }) => ({
    node: {
      get textContent() { return src; },
      set textContent(v) { if (el.isConnected) el.setAttribute(attr, v); },
      get isConnected() { return el.isConnected; },
    },
    src,
  }));
  await _translateBatch(pairs, lang, gen);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Restore every saved text node and ARIA attribute to English originals. */
export function restoreAll() {
  _obs?.disconnect();
  _obs = null;
  _orig.forEach((orig, node) => {
    if (node.isConnected) node.textContent = orig;
  });
  _orig.clear();
  _origAttrs.forEach((map, el) => {
    if (el.isConnected) {
      for (const [attr, orig] of Object.entries(map)) el.setAttribute(attr, orig);
    }
  });
  _origAttrs.clear();
}

/**
 * Translate the entire visible DOM to `lang`.
 * If lang === 'en', calls restoreAll() and returns.
 * Safe to call repeatedly; a generation counter aborts stale in-flight fetches.
 */
export async function translate(lang) {
  if (lang === 'en') { restoreAll(); return; }

  const gen = ++_gen;

  // Snapshot originals for all current text nodes
  const allNodes = _collect();
  const pairs = allNodes.map(node => {
    if (!_orig.has(node)) _orig.set(node, node.textContent);
    return { node, src: _orig.get(node) };
  }).filter(p => p.src.trim());

  await _translateBatch(pairs, lang, gen);
  if (gen !== _gen) return;

  // Translate ARIA attributes (aria-label, placeholder, alt) for screen readers
  await _applyAttrTranslations(_collectAttrPairs(), lang, gen);
  if (gen !== _gen) return;

  _startObserver(lang, gen);
}

/** Map app language codes → Google Translate codes where they differ. */
export const GOOGLE_LANG = {
  'zh':    'zh-CN',
  'zh-tw': 'zh-TW',
  'en-gb': 'en',
  'en-us': 'en',
};

/**
 * Full language list for the dropdown.
 * Replaces the JSON-file-gated supportedLanguages list.
 */
export const ALL_LANGS = [
  // Tiers ordered by global speaker count
  { code: 'en',    label: 'English' },
  { code: 'zh',    label: '中文 (简体)' },
  { code: 'zh-tw', label: '中文 (繁體)' },
  { code: 'hi',    label: 'हिन्दी' },
  { code: 'es',    label: 'Español' },
  { code: 'fr',    label: 'Français' },
  { code: 'ar',    label: 'العربية' },
  { code: 'bn',    label: 'বাংলা' },
  { code: 'pt',    label: 'Português' },
  { code: 'ru',    label: 'Русский' },
  { code: 'ja',    label: '日本語' },
  { code: 'de',    label: 'Deutsch' },
  { code: 'ko',    label: '한국어' },
  { code: 'it',    label: 'Italiano' },
  { code: 'tr',    label: 'Türkçe' },
  { code: 'vi',    label: 'Tiếng Việt' },
  { code: 'pl',    label: 'Polski' },
  { code: 'nl',    label: 'Nederlands' },
  { code: 'uk',    label: 'Українська' },
  { code: 'id',    label: 'Bahasa Indonesia' },
  { code: 'ms',    label: 'Bahasa Melayu' },
  { code: 'th',    label: 'ภาษาไทย' },
  { code: 'el',    label: 'Ελληνικά' },
  { code: 'he',    label: 'עברית' },
  { code: 'sv',    label: 'Svenska' },
  { code: 'no',    label: 'Norsk' },
  { code: 'da',    label: 'Dansk' },
  { code: 'fi',    label: 'Suomi' },
  { code: 'cs',    label: 'Čeština' },
  { code: 'ro',    label: 'Română' },
  { code: 'hu',    label: 'Magyar' },
  { code: 'tl',    label: 'Filipino' },
];
