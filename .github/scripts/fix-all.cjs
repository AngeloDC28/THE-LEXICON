const fs = require('fs');

// 1. FIX IMAGE PATHS IN database.js
console.log('Fixing image paths in database.js...');
let db = fs.readFileSync('database.js', 'utf8');

const folderMap = {
  'mcqueen-ss99': 'mcqueen-ss01',
  'mugler-aw95': 'mugler-aw92',
  'miyake-ss99': 'miyake-ss98',
  'balenciaga-ss07': 'margiela-ss89',
  'garcons-ss97': 'margiela-ss89',
  'gaultier-ss94': 'gaultier-aw93',
  'chalayan-aw00': 'chalayan-aw00',
  'prada-ss96': 'prada-ss96',
  'galliano-dior-ss00': 'galliano-dior-ss00',
  'owens-ss14': 'owens-ss14',
  'yamamoto-aw98': 'yamamoto-aw98',
  'viktor-rolf-aw99': 'viktor-rolf-aw99',
  'lang-aw98': 'lang-aw98',
  'moschino-aw14': 'moschino-aw14',
  'schiaparelli-ss21': 'schiaparelli-ss21',
  'wvb-aw95': 'wvb-aw95',
  'margiela-ss89': 'margiela-ss89',
};

db = db.replace(/THE-LEXICON-ASSETS\/([-\w]+)\/([-\w]+-)(\d+)\.jpg/g, (match, folder, _prefix, num) => {
  const newFolder = folderMap[folder] || folder;
  return 'data/' + newFolder + '/' + num + '.jpg';
});

fs.writeFileSync('database.js', db);
console.log('database.js done.');

// 2. FIX translations.js - Angelo info in About
console.log('Updating translations.js...');
let tr = fs.readFileSync('js/modules/translations.js', 'utf8');
tr = tr.replace(
  '"THE LEXICON is a high-density research terminal engineered for the forensic analysis of visual culture and subcultural theory."',
  '"THE LEXICON is a high-density research terminal created by Angelo Sanchez Dela Cruz for the forensic analysis of visual culture and subcultural theory."'
);
tr = tr.replace(
  '"Designed for cultural critics and visual strategists, this system decodes the underlying mechanics of class dynamics and bodily autonomy through the lens of visionary image-making."',
  '"Designed for cultural critics, students, and visual strategists, this system decodes the underlying mechanics of class dynamics and bodily autonomy through the lens of visionary image-making.",\n    "Created and maintained by Angelo Sanchez Dela Cruz \\u2014 researcher, cultural critic, and visual archivist based in London. For research enquiries: info@thelexicon.xyz"'
);
fs.writeFileSync('js/modules/translations.js', tr);
console.log('translations.js done.');

// 3. REWRITE search-engine.js with accordion taxonomy
console.log('Rewriting search-engine.js...');
const se = [
  "/**",
  " * search-engine.js - Filtering logic + accordion taxonomy UI.",
  " */",
  "import { $ } from './core-utils.js';",
  "import { AppState, taxonomyData } from './core-state.js';",
  "import { getTranslation } from './translations.js';",
  "",
  "let searchCache = new Map();",
  "",
  "export function getFilteredEntries(archiveData) {",
  "  const q = (AppState.searchQuery || '').toLowerCase();",
  "  const folId = AppState.activeFolderId;",
  "  const cacheKey = q + '|' + folId + '|' + JSON.stringify(AppState.filters);",
  "  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);",
  "  let entries = archiveData;",
  "  if (folId) {",
  "    const fol = AppState.archivalFolders.find(v => v.id === folId);",
  "    if (fol) entries = entries.filter(e => fol.lookIds.includes(e.id));",
  "  }",
  "  entries = entries.filter(entry => {",
  "    if (!entry.tags) return false;",
  "    for (const [key, val] of Object.entries(AppState.filters)) {",
  "      if (val && entry.tags[key] !== val) return false;",
  "    }",
  "    return true;",
  "  });",
  "  if (q) {",
  "    entries = entries.filter(entry => {",
  "      const parts = [entry.id||'',entry.title||'',entry.year?String(entry.year):'',entry.season||'',entry.description||'',...(entry.tags?Object.values(entry.tags):[]),...(entry.notes?Object.values(entry.notes):[])];",
  "      return parts.join(' ').toLowerCase().includes(q);",
  "    });",
  "  }",
  "  searchCache.set(cacheKey, entries);",
  "  if (searchCache.size > 50) searchCache.clear();",
  "  return entries;",
  "}",
  "",
  "export function renderTaxonomyGrid() {",
  "  const container = $('taxonomy-grid');",
  "  if (!container) return;",
  "  const lang = AppState.language;",
  "  const t = k => getTranslation(k, lang);",
  "  const types = [",
  "    {key:'brand',label:t('tax_brand')},",
  "    {key:'era',label:t('tax_era')},",
  "    {key:'politics',label:t('tax_politics')},",
  "    {key:'theories',label:t('tax_theories')},",
  "    {key:'gender',label:t('tax_gender')},",
  "    {key:'materials',label:t('tax_materials')},",
  "    {key:'geography',label:t('tax_geography')},",
  "    {key:'anatomy',label:t('tax_anatomy')},",
  "    {key:'format',label:t('tax_format')},",
  "  ];",
  "  container.innerHTML = types.map(type => {",
  "    const isOpen = AppState.activeTaxonomy === type.key;",
  "    const activeFilter = AppState.filters[type.key];",
  "    const values = taxonomyData[type.key] || [];",
  "    const hCls = isOpen ? 'bg-acid text-black border-acid' : activeFilter ? 'border-acid text-acid' : 'border-white/10 text-white/70 hover:text-white hover:border-white/40';",
  "    const aLabel = activeFilter ? ' [ ' + activeFilter.toUpperCase() + ' ]' : '';",
  "    const vHtml = isOpen ? values.map(val => {",
  "      const ia = AppState.filters[type.key] === val;",
  "      return '<button data-taxonomy-type=\\"' + type.key + '\\" data-taxonomy-val=\\"' + val + '\\" class=\\"w-full text-left px-4 py-1.5 text-[9px] font-mono tracking-widest uppercase transition-all ' + (ia ? 'text-acid font-bold bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5') + '\\">' + (ia ? '[ ' : '  ') + getTranslation(val, lang) + (ia ? ' ]' : '') + '</button>';",
  "    }).join('') : '';",
  "    return '<div class=\\"taxonomy-accordion border-b border-white/10\\">'",
  "      + '<button data-taxonomy-type=\\"' + type.key + '\\" class=\\"w-full flex items-center justify-between px-3 py-2.5 text-[9px] font-mono tracking-widest uppercase transition-all border-l-2 ' + hCls + '\\" aria-expanded=\\"' + isOpen + '\\">'",
  "      + '<span>' + type.label + aLabel + '</span>'",
  "      + '<span class=\\"text-[8px] opacity-50 ml-2\\">' + (isOpen ? '\u25b2' : '\u25bc') + '</span>'",
  "      + '</button>'",
  "      + '<div class=\\"overflow-hidden transition-all duration-200 ' + (isOpen ? 'max-h-96 pb-1' : 'max-h-0') + '\\">'",
  "      + vHtml + '</div></div>';",
  "  }).join('');",
  "}",
  "",
  "export function renderTaxonomySub(callbacks) {",
  "  const c = $('taxonomy-sub');",
  "  if (c) c.classList.add('hidden');",
  "}",
  "",
  "export function setActiveTaxonomy(type) {",
  "  AppState.activeTaxonomy = AppState.activeTaxonomy === type ? null : type;",
  "}"
].join('\n');
fs.writeFileSync('js/modules/search-engine.js', se);
console.log('search-engine.js done.');
console.log('ALL FIXES APPLIED.');
