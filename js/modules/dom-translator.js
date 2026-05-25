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
const CHAR_LIMIT = 1800;   // conservative per-request character budget
const SEP = '\n\n';        // batch separator (double newline, rare in UI strings)
const CACHE_PFX = 'lx-tx:';

// Tags whose content should never be translated
const SKIP_TAGS = new Set([
  'SCRIPT','STYLE','CODE','PRE','KBD','SAMP','NOSCRIPT','TEMPLATE',
  'SVG','MATH','INPUT','TEXTAREA','SELECT'
]);

// WeakMap: text node → English original text
const _orig = new WeakMap();
let _obs = null;
let _gen = 0; // incremented on every translate() call, used to abort stale fetches

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

async function _translateBatch(pairs, lang, gen) {
  if (!pairs.length) return;

  // Deduplicate: only send unique source strings
  const unique = [...new Set(pairs.map(p => p.src))];

  // Split unique strings into char-budget chunks
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

  const map = new Map(); // src text → translated text

  for (const ch of chunks) {
    if (gen !== _gen) return;

    const joined = ch.join(SEP);
    const cacheKey = CACHE_PFX + lang + ':' + _hash(joined);
    let results;

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) results = JSON.parse(cached);
    } catch (_) {}

    if (!results) {
      try {
        const raw = await _apiFetch(joined, lang);
        if (gen !== _gen) return;
        // Split response on SEP (double newline); Google usually preserves it
        results = raw.split(/\n\n+/).map(s => s.trim());
        // Pad/trim to match chunk length
        while (results.length < ch.length) results.push(ch[results.length] || '');
        results = results.slice(0, ch.length);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(results)); } catch (_) {}
      } catch (_) {
        results = ch; // network error → keep originals
      }
    }

    ch.forEach((src, i) => map.set(src, results[i] ?? src));
  }

  if (gen !== _gen) return;

  for (const { node, src } of pairs) {
    const tx = map.get(src);
    if (tx && tx !== src && node.isConnected) node.textContent = tx;
  }
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

// ─── Public API ─────────────────────────────────────────────────────────────

/** Restore every saved text node to its English original. */
export function restoreAll() {
  _obs?.disconnect();
  _obs = null;
  _orig.forEach((orig, node) => {
    if (node.isConnected) node.textContent = orig;
  });
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
