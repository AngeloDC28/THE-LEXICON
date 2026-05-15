const fs = require('fs');

// ============================================================
// 1. FIX IMAGE PATHS IN database.js (DISABLED)
// ============================================================
/*
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
};

db = db.replace(/THE-LEXICON-ASSETS\/([-\w]+)\/([-\w]+)-(\d+)\.jpg/g, (_, folder, _name, num) => {
  const newFolder = folderMap[folder] || folder;
  return 'data/' + newFolder + '/' + num + '.jpg';
});

fs.writeFileSync('database.js', db);
console.log('database.js image paths fixed.');
*/

// ============================================================
// 2. FIX translations.js - Add Angelo's name to About section
// ============================================================
console.log('Updating About text in translations.js...');
let tr = fs.readFileSync('js/modules/translations.js', 'utf8');

const oldAbout = '"THE LEXICON is a high-density research terminal engineered for the forensic analysis of visual culture and subcultural theory."';
const newAbout = '"THE LEXICON is a high-density research terminal created by Angelo Sanchez Dela Cruz for the forensic analysis of visual culture and subcultural theory."';
tr = tr.replace(oldAbout, newAbout);

const oldCredit = '"Designed for cultural critics and visual strategists, this system decodes the underlying mechanics of class dynamics and bodily autonomy through the lens of visionary image-making."';
const newCredit = '"Designed for cultural critics and visual strategists, this system decodes the underlying mechanics of class dynamics and bodily autonomy through the lens of visionary image-making.",\n    "Created and maintained by Angelo Sanchez Dela Cruz — researcher, cultural critic, and visual archivist. For research enquiries: info@thelexicon.xyz"';
tr = tr.replace(oldCredit, newCredit);

fs.writeFileSync('js/modules/translations.js', tr);
console.log('translations.js updated.');

// ============================================================
// 3. REWRITE search-engine.js with accordion dropdown taxonomy
// ============================================================
console.log('Rewriting search-engine.js with accordion dropdowns...');

const searchEngine = `/**
 * search-engine.js
 * Filtering logic + accordion taxonomy UI.
 */
import { $ } from './core-utils.js';
import { AppState, taxonomyData } from './core-state.js';
import { getTranslation } from './translations.js';

let searchCache = new Map();

export function getFilteredEntries(archiveData) {
  const q = (AppState.searchQuery || '').toLowerCase();
  const folId = AppState.activeFolderId;
  const filterKey = JSON.stringify(AppState.filters);
  const cacheKey = q + '|' + folId + '|' + filterKey;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  let entries = archiveData;

  if (folId) {
    const fol = AppState.archivalFolders.find(v => v.id === folId);
    if (fol) entries = entries.filter(e => fol.lookIds.includes(e.id));
  }

  entries = entries.filter(entry => {
    if (!entry.tags) return false;
    for (const [key, val] of Object.entries(AppState.filters)) {
      if (val && entry.tags[key] !== val) return false;
    }
    return true;
  });

  if (q) {
    entries = entries.filter(entry => {
      const parts = [
        entry.id || '',
        entry.title || '',
        entry.year ? String(entry.year) : '',
        entry.season || '',
        entry.description || '',
        ...(entry.tags ? Object.values(entry.tags) : []),
        ...(entry.notes ? Object.values(entry.notes) : [])
      ];
      return parts.join(' ').toLowerCase().includes(q);
    });
  }

  searchCache.set(cacheKey, entries);
  if (searchCache.size > 50) searchCache.clear();
  return entries;
}

export function renderTaxonomyGrid() {
  const container = $('taxonomy-grid');
  if (!container) return;
  const lang = AppState.language;
  const t = key => getTranslation(key, lang);

  const types = [
    { key: 'brand',     label: t('tax_brand') },
    { key: 'era',       label: t('tax_era') },
    { key: 'politics',  label: t('tax_politics') },
    { key: 'theories',  label: t('tax_theories') },
    { key: 'gender',    label: t('tax_gender') },
    { key: 'materials', label: t('tax_materials') },
    { key: 'geography', label: t('tax_geography') },
    { key: 'anatomy',   label: t('tax_anatomy') },
    { key: 'format',    label: t('tax_format') },
  ];

  container.innerHTML = types.map(type => {
    const isOpen = AppState.activeTaxonomy === type.key;
    const activeFilter = AppState.filters[type.key];
    const values = taxonomyData[type.key] || [];

    const headerClass = isOpen
      ? 'bg-acid text-black border-acid'
      : activeFilter
        ? 'border-acid text-acid'
        : 'border-white/10 text-white/70 hover:text-white hover:border-white/40';

    const activeLabel = activeFilter ? ' [ ' + activeFilter.toUpperCase() + ' ]' : '';

    const valuesHtml = isOpen ? values.map(val => {
      const isActive = AppState.filters[type.key] === val;
      const cls = isActive
        ? 'text-acid font-bold bg-white/5'
        : 'text-white/50 hover:text-white hover:bg-white/5';
      const prefix = isActive ? '[ ' : '  ';
      const suffix = isActive ? ' ]' : '';
      return '<button data-taxonomy-type="' + type.key + '" data-taxonomy-val="' + val + '" class="w-full text-left px-4 py-1.5 text-[9px] font-mono tracking-widest uppercase transition-all ' + cls + '">' + prefix + getTranslation(val, lang) + suffix + '</button>';
    }).join('') : '';

    return '<div class="taxonomy-accordion border-b border-white/10">'
      + '<button data-taxonomy-type="' + type.key + '" class="w-full flex items-center justify-between px-3 py-2.5 text-[9px] font-mono tracking-widest uppercase transition-all border-l-2 ' + headerClass + '" aria-expanded="' + isOpen + '">'
      + '<span>' + type.label + activeLabel + '</span>'
      + '<span class="text-[8px] opacity-50 ml-2">' + (isOpen ? '\\u25b2' : '\\u25bc') + '</span>'
      + '</button>'
      + '<div class="overflow-hidden transition-all duration-200 ' + (isOpen ? 'max-h-96 pb-1' : 'max-h-0') + '">'
      + valuesHtml
      + '</div>'
      + '</div>';
  }).join('');
}

export function renderTaxonomySub(callbacks) {
  const container = $('taxonomy-sub');
  if (container) container.classList.add('hidden');
}

export function setActiveTaxonomy(type) {
  AppState.activeTaxonomy = AppState.activeTaxonomy === type ? null : type;
}
\`;

fs.writeFileSync('js/modules/search-engine.js', searchEngine);
console.log('search-engine.js rewritten with accordion dropdowns.');
console.log('All fixes applied successfully.');
